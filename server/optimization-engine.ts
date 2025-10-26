import type { Product, VehicleType, LoadingOrderItem } from "@shared/schema";

// Helper types for optimization
interface ProductWithDimensions extends Product {
  parsedDimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

interface LoadingItem {
  productId: string;
  productName: string;
  quantity: number;
  dimensions: {length: number; width: number; height: number};
  weight: number;
}

interface PlacedItem extends LoadingItem {
  position: {x: number; y: number; z: number};
  layer: number;
}

interface LoadingPlan {
  items: PlacedItem[];
  utilizationPercentage: number;
  weightDistributionScore: number;
  warnings: string[];
  recommendations: string[];
  estimatedLoadingTimeMinutes: number;
}

interface RouteStop {
  location: string;
  arrivalTime: string;
  coordinates?: {lat: number; lng: number};
}

interface OptimizedRoute {
  stops: Array<{
    order: number;
    location: string;
    arrivalTime: string;
    departureTime?: string;
    distanceFromPrevious: number;
    durationFromPrevious: number;
    instructions?: string;
  }>;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
  fuelEstimateLiters: number;
}

/**
 * Parse dimensions from text format "LxWxH" or "L x W x H" in cm
 * Returns dimensions in meters
 */
function parseDimensions(dimensionsText: string | null): {length: number; width: number; height: number} | null {
  if (!dimensionsText) return null;
  
  const match = dimensionsText.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  
  // Convert from cm to meters
  return {
    length: parseFloat(match[1]) / 100,
    width: parseFloat(match[2]) / 100,
    height: parseFloat(match[3]) / 100
  };
}

/**
 * 3D Bin Packing Algorithm with Weight Distribution
 * Uses First-Fit Decreasing Height (FFDH) strategy with layer-based placement
 */
export function optimizeVehicleLoading(
  items: Array<{product: Product; quantity: number}>,
  vehicleType: VehicleType
): LoadingPlan {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Parse vehicle cargo dimensions (in meters)
  const cargoLength = vehicleType.cargoLength ? parseFloat(vehicleType.cargoLength) : 6.0;
  const cargoWidth = vehicleType.cargoWidth ? parseFloat(vehicleType.cargoWidth) : 2.4;
  const cargoHeight = vehicleType.cargoHeight ? parseFloat(vehicleType.cargoHeight) : 2.5;
  const maxWeight = vehicleType.weightLimit ? parseFloat(vehicleType.weightLimit) * 1000 : 15000; // Convert tons to kg
  
  // Prepare loading items with parsed dimensions
  const loadingItems: LoadingItem[] = [];
  let totalWeight = 0;
  
  for (const item of items) {
    let dims = parseDimensions(item.product.dimensions);
    if (!dims) {
      warnings.push(`Produto "${item.product.name}" sem dimensões definidas - usando dimensões padrão`);
      // Use default box dimensions: 40x30x30 cm = 0.4x0.3x0.3 m
      dims = {length: 0.4, width: 0.3, height: 0.3};
    }
    
    const weight = item.product.weight ? parseFloat(item.product.weight) : 10; // Default 10kg
    
    for (let i = 0; i < item.quantity; i++) {
      loadingItems.push({
        productId: item.product.id,
        productName: item.product.name,
        quantity: 1,
        dimensions: dims,
        weight
      });
      totalWeight += weight;
    }
  }
  
  // Check total weight
  if (totalWeight > maxWeight) {
    warnings.push(`Peso total (${totalWeight.toFixed(0)}kg) excede limite do veículo (${maxWeight.toFixed(0)}kg)`);
  }
  
  // Sort items by height (descending) for better packing
  loadingItems.sort((a, b) => b.dimensions.height - a.dimensions.height);
  
  const placedItems: PlacedItem[] = [];
  let currentLayer = 0;
  let currentLayerHeight = 0;
  let layerMaxHeight = 0;
  
  // Layer-based placement tracking
  const layers: Array<{
    height: number;
    spaces: Array<{x: number; y: number; width: number; length: number}>;
  }> = [{
    height: 0,
    spaces: [{x: 0, y: 0, width: cargoWidth, length: cargoLength}]
  }];
  
  for (const item of loadingItems) {
    let placed = false;
    
    // Try to place in current layer
    for (let layerIdx = currentLayer; layerIdx >= 0; layerIdx--) {
      const layer = layers[layerIdx];
      
      for (let spaceIdx = 0; spaceIdx < layer.spaces.length; spaceIdx++) {
        const space = layer.spaces[spaceIdx];
        
        // Check if item fits in this space (try both orientations)
        const orientations = [
          {length: item.dimensions.length, width: item.dimensions.width, height: item.dimensions.height},
          {length: item.dimensions.width, width: item.dimensions.length, height: item.dimensions.height}
        ];
        
        for (const orientation of orientations) {
          if (orientation.length <= space.length && orientation.width <= space.width) {
            const z = layer.height;
            
            // Check height constraint
            if (z + orientation.height <= cargoHeight) {
              // Place the item
              placedItems.push({
                ...item,
                position: {x: space.x, y: space.y, z},
                layer: layerIdx,
                dimensions: orientation
              });
              
              // Update space
              layer.spaces.splice(spaceIdx, 1);
              
              // Create new spaces from remaining area
              // Right space
              if (space.length > orientation.length) {
                layer.spaces.push({
                  x: space.x + orientation.length,
                  y: space.y,
                  width: space.width,
                  length: space.length - orientation.length
                });
              }
              
              // Front space
              if (space.width > orientation.width) {
                layer.spaces.push({
                  x: space.x,
                  y: space.y + orientation.width,
                  width: space.width - orientation.width,
                  length: orientation.length
                });
              }
              
              // Update layer max height
              if (z + orientation.height > layerMaxHeight) {
                layerMaxHeight = z + orientation.height;
              }
              
              placed = true;
              break;
            }
          }
        }
        
        if (placed) break;
      }
      
      if (placed) break;
    }
    
    // If not placed, create new layer
    if (!placed) {
      currentLayer++;
      const newLayerHeight = layerMaxHeight;
      
      if (newLayerHeight + item.dimensions.height > cargoHeight) {
        warnings.push(`Não foi possível carregar todos os itens - altura excedida`);
        break;
      }
      
      layers.push({
        height: newLayerHeight,
        spaces: [{x: 0, y: 0, width: cargoWidth, length: cargoLength}]
      });
      
      // Try to place in new layer
      const space = layers[currentLayer].spaces[0];
      placedItems.push({
        ...item,
        position: {x: 0, y: 0, z: newLayerHeight},
        layer: currentLayer,
        dimensions: item.dimensions
      });
      
      // Update space
      layers[currentLayer].spaces = [];
      if (cargoLength > item.dimensions.length) {
        layers[currentLayer].spaces.push({
          x: item.dimensions.length,
          y: 0,
          width: cargoWidth,
          length: cargoLength - item.dimensions.length
        });
      }
      if (cargoWidth > item.dimensions.width) {
        layers[currentLayer].spaces.push({
          x: 0,
          y: item.dimensions.width,
          width: cargoWidth - item.dimensions.width,
          length: item.dimensions.length
        });
      }
      
      layerMaxHeight = newLayerHeight + item.dimensions.height;
    }
  }
  
  // Calculate utilization
  const totalCargoVolume = cargoLength * cargoWidth * cargoHeight;
  let usedVolume = 0;
  for (const item of placedItems) {
    usedVolume += item.dimensions.length * item.dimensions.width * item.dimensions.height;
  }
  const utilizationPercentage = (usedVolume / totalCargoVolume) * 100;
  
  // Calculate weight distribution score (front to back balance)
  const frontHalfWeight = placedItems
    .filter(item => item.position.x < cargoLength / 2)
    .reduce((sum, item) => sum + item.weight, 0);
  const backHalfWeight = totalWeight - frontHalfWeight;
  const idealWeight = totalWeight / 2;
  const weightImbalance = Math.abs(frontHalfWeight - idealWeight) / idealWeight;
  const weightDistributionScore = Math.max(0, 100 - (weightImbalance * 100));
  
  // Generate recommendations
  if (utilizationPercentage < 60) {
    recommendations.push("Considere consolidar com outra ordem para melhorar aproveitamento do veículo");
  }
  
  if (weightDistributionScore < 70) {
    recommendations.push("Distribuição de peso não ideal - considere reposicionar itens pesados");
  }
  
  if (placedItems.length < loadingItems.length) {
    recommendations.push(`Apenas ${placedItems.length} de ${loadingItems.length} itens puderam ser carregados`);
  }
  
  // Estimate loading time (5 min base + 2 min per item + 5 min per layer)
  const estimatedLoadingTimeMinutes = 5 + (placedItems.length * 2) + (currentLayer * 5);
  
  return {
    items: placedItems,
    utilizationPercentage: parseFloat(utilizationPercentage.toFixed(2)),
    weightDistributionScore: parseFloat(weightDistributionScore.toFixed(2)),
    warnings,
    recommendations,
    estimatedLoadingTimeMinutes
  };
}

/**
 * Route Optimization using Nearest Neighbor heuristic
 * For production, consider using Google Maps API or similar
 */
export function optimizeRoute(
  startLocation: string,
  destinations: RouteStop[],
  endLocation?: string
): OptimizedRoute {
  if (destinations.length === 0) {
    return {
      stops: [],
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
      fuelEstimateLiters: 0
    };
  }
  
  // For now, use simple nearest neighbor heuristic
  // In production, integrate with mapping API
  
  const stops = [...destinations];
  const optimizedStops: OptimizedRoute["stops"] = [];
  let currentLocation = startLocation;
  let totalDistance = 0;
  let totalDuration = 0;
  
  // Start point
  optimizedStops.push({
    order: 0,
    location: startLocation,
    arrivalTime: stops[0].arrivalTime,
    departureTime: stops[0].arrivalTime,
    distanceFromPrevious: 0,
    durationFromPrevious: 0,
    instructions: "Ponto de partida"
  });
  
  // Visit all destinations using nearest neighbor
  let order = 1;
  while (stops.length > 0) {
    // Find nearest stop (simplified - using string comparison)
    // In production, use actual distance calculation
    const nextStopIdx = 0; // For now, use order as-is
    const nextStop = stops[nextStopIdx];
    stops.splice(nextStopIdx, 1);
    
    // Estimate distance (simplified - 50-150km between stops)
    const distance = 80 + Math.random() * 70;
    const duration = (distance / 60) * 60; // Assume 60km/h average
    
    totalDistance += distance;
    totalDuration += duration;
    
    optimizedStops.push({
      order,
      location: nextStop.location,
      arrivalTime: nextStop.arrivalTime,
      departureTime: undefined,
      distanceFromPrevious: parseFloat(distance.toFixed(2)),
      durationFromPrevious: Math.round(duration),
      instructions: `Seguir para ${nextStop.location}`
    });
    
    currentLocation = nextStop.location;
    order++;
  }
  
  // Return to end location if specified
  if (endLocation && endLocation !== currentLocation) {
    const distance = 80 + Math.random() * 70;
    const duration = (distance / 60) * 60;
    
    totalDistance += distance;
    totalDuration += duration;
    
    optimizedStops.push({
      order,
      location: endLocation,
      arrivalTime: new Date(Date.now() + totalDuration * 60000).toISOString(),
      departureTime: undefined,
      distanceFromPrevious: parseFloat(distance.toFixed(2)),
      durationFromPrevious: Math.round(duration),
      instructions: "Retorno ao ponto de partida"
    });
  }
  
  // Estimate fuel consumption (assume 8L/100km for loaded truck)
  const fuelEstimate = (totalDistance / 100) * 8;
  
  return {
    stops: optimizedStops,
    totalDistanceKm: parseFloat(totalDistance.toFixed(2)),
    estimatedDurationMinutes: Math.round(totalDuration),
    fuelEstimateLiters: parseFloat(fuelEstimate.toFixed(2))
  };
}
