# Guia de Implementação Futura: Sistema Avançado de Papéis e Permissões

> Documento de **roadmap/inspiração** para a evolução do sistema de RBAC
> além das Fases 1 e 2. Não descreve o estado atual — para isso, consulte
> `replit.md` e os changelogs `docs/CHANGELOG-fase1.md` /
> `docs/CHANGELOG-fase2.md`.

## Visão Geral
Este guia documenta melhorias planejadas para o sistema de gerenciamento de papéis e permissões, baseado em boas práticas de UX, segurança e usabilidade corporativa.

## Problemas da Implementação Atual
- Lista simples sem agrupamento lógico de módulos
- Falta de hierarquia visual entre permissões
- Ausência de busca/filtros eficientes
- Sem indicação de dependências entre permissões
- Processo manual individual para cada checkbox
- Falta de templates ou perfis pré-definidos
- Sem preview do impacto de cada permissão
- Ausência de auditoria (quem alterou, quando)

## Estrutura Proposta

### Layout Master-Detail
Interface dividida em dois painéis:
- **Painel Esquerdo**: Árvore hierárquica de módulos com indicadores visuais
- **Painel Direito**: Configuração detalhada de permissões com contexto

### Organização Hierárquica de Módulos

**Categorias Principais:**
1. **OPERACIONAL**: Estoque, Movimentações, Eventos, Localizações
2. **ADMINISTRATIVO**: Usuários, Papéis, Configurações, Relatórios
3. **FINANCEIRO**: Contratos, Custos, Análises
4. **MANUTENÇÃO**: Ordens de Serviço, Histórico, Preventiva

**Indicadores Visuais:**
- [•] = Todas as permissões concedidas
- [◐] = Algumas permissões concedidas
- [○] = Nenhuma permissão concedida
- Contador de permissões: (2/4)

### Sistema de Permissões Detalhado

**Níveis de Permissão:**
1. **Básicas**: Visualizar, Criar, Editar, Excluir
2. **Avançadas**: Configurações específicas do módulo
3. **Relatórios**: Acesso a diferentes tipos de relatórios

**Informações por Permissão:**
- Descrição clara do que permite
- Dependências (auto-seleção de pré-requisitos)
- Nível de impacto (Baixo, Médio, Alto, Crítico)
- Ícones intuitivos para cada ação

**Sistema de Dependências Automáticas:**
- Criar/Editar/Excluir → Auto-seleciona Visualizar
- Excluir → Requer Editar
- Relatórios → Requer Visualizar do módulo
- Alertas visuais para dependências não atendidas

## Funcionalidades Avançadas

### Templates Pré-Definidos
1. **Operador Básico**: Visualizar módulos operacionais, criar/editar eventos e movimentações
2. **Supervisor**: Operador Básico + edição de produtos, relatórios gerenciais
3. **Gerente**: Supervisor + administração de usuários, relatórios completos
4. **Administrador**: Acesso total ao sistema

### Ferramentas de Produtividade
- Busca em tempo real por módulos/permissões
- Seleção em massa por categoria
- Copiar permissões de outro papel
- Exportar/Importar configurações
- Resetar para padrões
- Visualizar como usuário (preview)

### Resumo e Validação
Modal de confirmação antes de salvar mostrando:
- Módulos com acesso total
- Módulos com acesso parcial
- Módulos sem acesso
- Alertas de segurança para permissões críticas
- Lista de mudanças realizadas

## Sistema de Auditoria

**Rastreamento Completo:**
- Data/hora da alteração
- Usuário que fez a alteração
- Permissões adicionadas
- Permissões removidas
- Templates aplicados
- Histórico completo de modificações

## Códigos Visuais

**Cores por Nível de Acesso:**
- Verde: Acesso total ao módulo
- Amarelo: Acesso parcial ao módulo
- Vermelho: Nenhum acesso ao módulo
- Azul: Permissões administrativas
- Roxo: Permissões de relatórios

**Ícones Padronizados:**
- 👁️ Visualizar | ➕ Criar | ✏️ Editar | 🗑️ Excluir
- 📊 Relatórios | ⚙️ Configuração | 🔐 Admin | ⚠️ Crítico

**Indicadores de Status:**
- ✅ Permissão concedida
- ❌ Permissão negada
- 🔒 Permissão bloqueada (dependência)
- ⚠️ Permissão com impacto alto
- 🔄 Permissão herdada de template

## Benefícios Esperados

**Para Administradores:**
- Configuração 70% mais rápida com templates
- Visão clara e estruturada de permissões
- Auditoria completa de alterações
- Prevenção de erros com validação automática

**Para Segurança:**
- Controle granular de acessos
- Rastreabilidade total de mudanças
- Alertas para permissões críticas
- Validação antes de aplicar mudanças

**Para Usuários:**
- Interface intuitiva e organizada
- Feedback claro sobre permissões
- Menos erros de configuração
- Melhor experiência geral

## Implementação Técnica Sugerida

**Backend:**
- Expandir tabela `permissions` com campos: `module`, `category`, `impact_level`, `dependencies`
- Criar tabela `permission_templates` para perfis pré-definidos
- Implementar auditoria em tabela `permission_audit_log`
- API para validação de dependências

**Frontend:**
- Componente de árvore hierárquica (React)
- Sistema de busca/filtro em tempo real
- Modal de confirmação com resumo
- Componente de histórico de auditoria
- Sistema de notificações para mudanças críticas

**Estado Atual (Phase 1):**
- ✅ Ownership-based permissions implementado
- ✅ Admin override funcional
- ✅ Validação dupla (UI + backend)
- ✅ Sistema básico de roles via userRoles table

**Próximas Fases:**
- Phase 2: Implementar hierarquia de roles e herança de permissões
- Phase 3: Sistema de auditoria completo
- Phase 4: Templates e seleção em massa
- Phase 5: Interface avançada master-detail
- Phase 6: Sistema de dependências automáticas
