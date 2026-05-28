"""Gera um PDF tecnico detalhado do EventFlow para devs back-end e front-end."""
from fpdf import FPDF
from datetime import datetime


PRIMARY = (30, 58, 138)
ACCENT = (236, 72, 153)
MUTED = (100, 116, 139)
LIGHT_BG = (241, 245, 249)
DARK_TEXT = (15, 23, 42)


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "EventFlow Logistics  -  Documentacao Tecnica", align="L")
        self.cell(0, 8, f"Pagina {self.page_no()}", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*LIGHT_BG)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Gerado automaticamente - EventFlow Logistics", align="C")


def h1(pdf, text):
    pdf.ln(2)
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, f"  {text}", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.set_text_color(*DARK_TEXT)


def h2(pdf, text):
    pdf.ln(2)
    pdf.set_text_color(*PRIMARY)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(0.6)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + 40, pdf.get_y())
    pdf.ln(3)
    pdf.set_text_color(*DARK_TEXT)


def h3(pdf, text):
    pdf.ln(1)
    pdf.set_text_color(*ACCENT)
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(*DARK_TEXT)


def p(pdf, text):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*DARK_TEXT)
    pdf.multi_cell(0, 5.2, text)
    pdf.ln(1)


def bullet(pdf, text):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*DARK_TEXT)
    pdf.set_x(pdf.l_margin + 4)
    pdf.cell(4, 5.2, chr(149))
    pdf.multi_cell(0, 5.2, text)


def kv(pdf, key, value):
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*PRIMARY)
    x0 = pdf.l_margin
    pdf.set_x(x0)
    pdf.cell(38, 5.5, f"{key}:")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*DARK_TEXT)
    avail = pdf.w - pdf.r_margin - (x0 + 38)
    pdf.multi_cell(avail, 5.5, value)


def table(pdf, headers, rows, widths):
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(*PRIMARY)
    pdf.set_text_color(255, 255, 255)
    for h, w in zip(headers, widths):
        pdf.cell(w, 7, f" {h}", border=0, fill=True)
    pdf.ln(7)
    pdf.set_text_color(*DARK_TEXT)
    pdf.set_font("Helvetica", "", 9)
    for i, row in enumerate(rows):
        fill = i % 2 == 0
        if fill:
            pdf.set_fill_color(*LIGHT_BG)
        line_h = 5.2
        # compute max height for the row
        max_lines = 1
        for cell, w in zip(row, widths):
            n_lines = len(pdf.multi_cell(w - 2, line_h, str(cell), split_only=True))
            max_lines = max(max_lines, n_lines)
        row_h = max_lines * line_h
        x_start = pdf.get_x()
        y_start = pdf.get_y()
        if y_start + row_h > pdf.page_break_trigger:
            pdf.add_page()
            y_start = pdf.get_y()
            x_start = pdf.get_x()
        for cell, w in zip(row, widths):
            x = pdf.get_x()
            y = pdf.get_y()
            if fill:
                pdf.rect(x, y, w, row_h, "F")
            pdf.multi_cell(w, line_h, f" {cell}", border=0)
            pdf.set_xy(x + w, y)
        pdf.ln(row_h)


def cover(pdf):
    pdf.add_page()
    pdf.set_fill_color(*PRIMARY)
    pdf.rect(0, 0, pdf.w, 80, "F")
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, 75, pdf.w, 5, "F")

    pdf.set_y(25)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 28)
    pdf.cell(0, 14, "EventFlow Logistics", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 14)
    pdf.cell(0, 8, "Documentacao Tecnica - Back-end & Front-end", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "I", 11)
    pdf.cell(0, 7, "Sistema de Gestao Logistica de Materiais para Eventos", align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(110)
    pdf.set_text_color(*DARK_TEXT)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, "Conteudo deste documento", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    sections = [
        "1. Objetivo do sistema e dominio de negocio",
        "2. Stack tecnico (back-end e front-end)",
        "3. Estrutura de pastas do projeto",
        "4. Modelo de dados (tabelas e relacionamentos)",
        "5. Paginas e rotas do front-end",
        "6. Endpoints REST do back-end",
        "7. Autenticacao, autorizacao e propriedade",
        "8. Layout, componentes e design system",
        "9. Features importantes (regras de negocio)",
        "10. Estado atual do layout / UX",
        "11. Pontos fracos e dividas tecnicas",
        "12. Recomendacoes priorizadas",
    ]
    pdf.set_font("Helvetica", "", 10)
    for s in sections:
        pdf.set_x(pdf.l_margin + 8)
        pdf.cell(0, 6, s, new_x="LMARGIN", new_y="NEXT")

    pdf.set_y(pdf.h - 30)
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 5, f"Gerado em {datetime.now().strftime('%d/%m/%Y')}", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, "Documento de referencia para o time de desenvolvimento", align="C")


def main():
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(15, 15, 15)

    cover(pdf)

    # -------- 1. Objetivo --------
    pdf.add_page()
    h1(pdf, "1. Objetivo do Sistema e Dominio de Negocio")
    p(pdf,
      "O EventFlow Logistics e um sistema web para gerenciamento de materiais "
      "de eventos. Tudo gira em torno do conceito de 'guarda-chuva do evento': "
      "cada movimentacao, requisicao, carregamento e devolucao esta vinculada a "
      "um evento especifico, permitindo rastrear o ciclo de vida completo do material.")

    h2(pdf, "Quem usa o sistema")
    for item in [
        "Equipe de planejamento (cria eventos e define janelas de requisicao).",
        "Cenografia / producao (faz pedidos de materiais para o evento).",
        "Supervisores (aprovam pedidos total, parcial ou rejeitam).",
        "Almoxarifado (separa material e processa movimentacoes).",
        "Logistica e motoristas (planejam viagens e rotas).",
        "Administracao (cadastros, usuarios, permissoes).",
    ]:
        bullet(pdf, item)

    h2(pdf, "Ciclo de vida tipico de um evento")
    p(pdf, "1. Evento e criado com datas de setup, evento e desmontagem.")
    p(pdf, "2. Equipes solicitam materiais via requisicao (status: rascunho -> pendente).")
    p(pdf, "3. Supervisor aprova totalmente, parcialmente ou rejeita.")
    p(pdf, "4. Aprovacoes geram ordens de carregamento (com explosao de kits).")
    p(pdf, "5. Logistica monta viagens (veiculo + motorista + destinos).")
    p(pdf, "6. Almoxarifado executa movimentacoes (saida -> evento -> retorno).")
    p(pdf, "7. Devolucao registra perdas, danos e baixas no estoque.")

    # -------- 2. Stack --------
    h1(pdf, "2. Stack Tecnico")

    h2(pdf, "Back-end")
    kv(pdf, "Runtime", "Node.js (ES Modules) + TypeScript 5.6")
    kv(pdf, "Framework", "Express.js")
    kv(pdf, "Banco de dados", "PostgreSQL via Neon Serverless")
    kv(pdf, "ORM", "Drizzle ORM + drizzle-kit (migracoes)")
    kv(pdf, "Validacao", "Zod (schemas derivados via drizzle-zod)")
    kv(pdf, "Autenticacao", "Passport.js (local strategy) + bcrypt + express-session (store PG)")
    kv(pdf, "Storage", "Replit Object Storage (Google Cloud Storage) - imagens de produto, CNH, etc.")
    kv(pdf, "Excel", "SheetJS (xlsx) para import e export")

    h2(pdf, "Front-end")
    kv(pdf, "Framework", "React 18 + TypeScript + Vite")
    kv(pdf, "Roteamento", "Wouter (alternativa leve ao React Router)")
    kv(pdf, "Estado server", "TanStack Query v5 (cache, invalidacao automatica)")
    kv(pdf, "Formularios", "React Hook Form + Zod (zodResolver)")
    kv(pdf, "UI", "Radix UI + shadcn/ui (estilo 'New York') + Tailwind CSS")
    kv(pdf, "Icones", "lucide-react (acoes), react-icons/si (logos)")
    kv(pdf, "Graficos", "Recharts (dashboard)")
    kv(pdf, "Fonte", "Inter (Google Fonts)")

    # -------- 3. Estrutura --------
    h1(pdf, "3. Estrutura de Pastas")
    p(pdf, "Projeto monorepo simples, dividido em tres areas principais:")

    h3(pdf, "client/  (front-end)")
    bullet(pdf, "src/pages/  - paginas (uma por rota)")
    bullet(pdf, "src/components/  - componentes reutilizaveis (sidebar, dialogs)")
    bullet(pdf, "src/components/ui/  - primitivos shadcn (Button, Card, Dialog...)")
    bullet(pdf, "src/hooks/  - hooks (use-auth, use-toast, use-mobile)")
    bullet(pdf, "src/lib/  - utilitarios (queryClient, protected-route, utils)")

    h3(pdf, "server/  (back-end)")
    bullet(pdf, "index.ts  - bootstrap do Express")
    bullet(pdf, "routes.ts  - todas as rotas REST (~3100 linhas - grande demais)")
    bullet(pdf, "storage.ts  - camada de acesso a dados (Repository pattern)")
    bullet(pdf, "auth.ts  - configuracao Passport + sessao")
    bullet(pdf, "ownership.ts  - utilitarios de permissao (admin / dono)")
    bullet(pdf, "optimization-engine.ts  - bin packing 3D + roteamento")
    bullet(pdf, "vite.ts  - integracao Vite (dev)")

    h3(pdf, "shared/  (tipos compartilhados)")
    bullet(pdf, "schema.ts  - tabelas Drizzle + schemas Zod + tipos TS (~1600 linhas)")

    # -------- 4. Modelo de Dados --------
    h1(pdf, "4. Modelo de Dados")
    p(pdf,
      "O schema e centrado no evento. Toda movimentacao de material e "
      "rastreavel ate o evento que a originou. As principais tabelas estao "
      "agrupadas abaixo por dominio.")

    h2(pdf, "Cadastros base")
    table(pdf,
          ["Tabela", "Campos principais", "Notas"],
          [
            ["users", "id, username, email, passwordHash, role, approvalStatus, active", "Aprovacao obrigatoria de admin"],
            ["events", "id, code, name, dates (setup/event/teardown), requestWindow", "Define janela de requisicao"],
            ["products", "id, sku, name, currentStock, minimumStock, ownership, type", "Owned / rented / third_party"],
            ["product_variants", "id, productId, sku, supplierId", "SKU especifico de fornecedor"],
            ["kits + bom_lines", "id, name, formula, quantity", "Explosao parametrica"],
            ["suppliers", "id, name, document, contact", "Fornecedores e locadores"],
            ["drivers", "id, name, cnh, cnhValidity, cnhImage", "Validacao de CNH"],
            ["vehicle_types", "id, name, capacity, dimensions", "Usado no bin packing"],
            ["locations", "id, name, type", "Galpao, evento, manutencao"],
            ["product_statuses", "id, name", "Disponivel, em uso, defeito..."],
          ],
          [32, 90, 58])

    h2(pdf, "Requisicoes e aprovacao")
    table(pdf,
          ["Tabela", "Campos principais", "Notas"],
          [
            ["material_requests", "id, eventId, requestedBy(FK users), status, submittedAt", "Fluxo: draft -> pending -> approved"],
            ["request_items", "id, requestId, productId, quantity, approvedQuantity", "Aprovacao parcial por item"],
            ["request_audit_log", "id, requestId, action, userId, timestamp", "Trilha de auditoria"],
          ],
          [40, 90, 50])

    h2(pdf, "Carregamento e transporte")
    table(pdf,
          ["Tabela", "Campos principais", "Notas"],
          [
            ["loading_orders", "id, eventId, status, createdBy", "Consolida requisicoes aprovadas"],
            ["loading_order_items", "id, orderId, productId, quantity, source", "Origem: pedido/kit"],
            ["trips", "id, vehicleTypeId, driverId, date, status", "Pode ter multiplos destinos"],
            ["trip_items", "id, tripId, productId, quantity", "Carga da viagem"],
            ["trip_stops", "id, tripId, eventId, sequence, eta", "Sequencia otimizada"],
            ["docks", "id, name, available", "Docas de carga"],
          ],
          [40, 90, 50])

    h2(pdf, "Movimentacoes (almoxarifado)")
    table(pdf,
          ["Tabela", "Campos principais", "Notas"],
          [
            ["movement_groups", "id, name", "Categoria de movimento"],
            ["movement_types", "id, groupId, nature, requiresApproval", "Configuravel: inbound/outbound"],
            ["movements", "id, typeId, status, createdBy, sourceLocId, targetLocId", "Estados: created/in_progress/done"],
            ["movement_items", "id, movementId, productId, quantity, scannedAt", "Suporte a scanner"],
          ],
          [42, 95, 43])

    h2(pdf, "Permissoes e notificacoes")
    table(pdf,
          ["Tabela", "Campos principais", "Notas"],
          [
            ["user_roles", "userId, role", "RBAC simples (admin, supervisor...)"],
            ["permissions", "id, code, description", "Granular por modulo (em planejamento)"],
            ["role_permissions", "roleId, permissionId", "Many-to-many"],
            ["notifications", "id, userId, type, payload, read", "In-app + @mentions"],
            ["notification_prefs", "userId, channel, enabled", "Painel de preferencias"],
          ],
          [40, 90, 50])

    # -------- 5. Paginas --------
    h1(pdf, "5. Paginas e Rotas do Front-end")
    p(pdf, "Roteamento via Wouter. Todas as rotas (exceto /auth) sao protegidas e validam permissoes.")

    h2(pdf, "Operacional")
    bullet(pdf, "/  - Dashboard (KPIs, alertas, eventos proximos)")
    bullet(pdf, "/requests  - Listagem de requisicoes")
    bullet(pdf, "/requests/:id  - Detalhes + aprovacao por item")
    bullet(pdf, "/loading-orders  - Ordens de carregamento")
    bullet(pdf, "/movements  - Movimentacoes do almoxarifado")
    bullet(pdf, "/returns  - Devolucoes (perdas e danos)")

    h2(pdf, "Estoque e catalogo")
    bullet(pdf, "/inventory  - Posicao atual de estoque")
    bullet(pdf, "/inventory/views  - Visoes salvas com filtros")
    bullet(pdf, "/events  - CRUD de eventos")
    bullet(pdf, "/products  - CRUD de produtos + variantes")
    bullet(pdf, "/kits  - Kits e BOM (estruturas)")
    bullet(pdf, "/suppliers  - Fornecedores")

    h2(pdf, "Transporte e relatorios")
    bullet(pdf, "/transport/trips  - Viagens (lista + calendario)")
    bullet(pdf, "/reports/stock-simulation  - Simulacao de faltas por data")
    bullet(pdf, "/reports/stock-position-simulation  - Projecao temporal de estoque")

    h2(pdf, "Configuracao (admin)")
    bullet(pdf, "/config/users  - Aprovacao e gestao de usuarios")
    bullet(pdf, "/config/roles  - Papeis e permissoes")
    bullet(pdf, "/config/vehicles  - Tipos de veiculo")
    bullet(pdf, "/config/drivers  - Motoristas (CNH)")
    bullet(pdf, "/config/locations  - Localizacoes fisicas")
    bullet(pdf, "/config/product-statuses  - Status de produtos")
    bullet(pdf, "/config/movement-types  - Grupos e tipos de movimento")

    h2(pdf, "Autenticacao")
    bullet(pdf, "/auth  - Login, cadastro e recuperacao de senha")

    # -------- 6. Endpoints --------
    h1(pdf, "6. Endpoints REST")
    p(pdf, "Todos seguem o padrao /api/<recurso>. JSON in/out. Validacao com Zod antes de chamar storage.")

    h2(pdf, "Autenticacao")
    bullet(pdf, "POST /api/login, POST /api/register, POST /api/logout, GET /api/user")
    bullet(pdf, "POST /api/forgot-password, POST /api/reset-password (token)")

    h2(pdf, "Eventos")
    bullet(pdf, "GET /api/events, GET /:id, POST /api/events, PATCH /:id, DELETE /:id")
    bullet(pdf, "POST /api/events/bulk  - importacao Excel")

    h2(pdf, "Requisicoes (com checks de propriedade)")
    bullet(pdf, "GET /api/requests, GET /:id, POST /api/requests")
    bullet(pdf, "PATCH /:id  - bloqueia mudanca direta para approved/rejected")
    bullet(pdf, "POST /:id/approve, POST /:id/approve-partial, POST /:id/reject")
    bullet(pdf, "POST /:id/duplicate, POST /:id/items, DELETE /api/request-items/:id")

    h2(pdf, "Carregamento e transporte")
    bullet(pdf, "GET/POST/PATCH /api/loading-orders")
    bullet(pdf, "GET/POST /api/trips, POST /api/trips/bulk")
    bullet(pdf, "POST /api/optimize/loading, POST /api/optimize/route")

    h2(pdf, "Movimentacoes")
    bullet(pdf, "GET/POST /api/movements")
    bullet(pdf, "PATCH /:id/status  - transicoes (created -> in_progress -> done)")
    bullet(pdf, "POST /:id/approve  - quando o tipo exige aprovacao")
    bullet(pdf, "POST /:id/items  - itens via scanner")

    h2(pdf, "Relatorios e cadastros")
    bullet(pdf, "POST /api/reports/stock-simulation, /stock-position-simulation")
    bullet(pdf, "GET/POST /api/products, /kits, /suppliers, /drivers (DELETE admin-only)")
    bullet(pdf, "GET/POST /api/locations, /product-statuses, /movement-types")

    # -------- 7. Autenticacao --------
    h1(pdf, "7. Autenticacao, Autorizacao e Propriedade")

    h2(pdf, "Autenticacao")
    p(pdf,
      "Passport local com bcrypt. Sessao guardada em PostgreSQL "
      "(connect-pg-simple). O cliente recebe o usuario via GET /api/user e "
      "esse estado fica em cache no TanStack Query.")

    h2(pdf, "Aprovacao de usuarios")
    p(pdf,
      "Novo usuario entra com approvalStatus='pending' e nao consegue logar. "
      "Admin precisa aprovar em /config/users. Trilha de auditoria com data e "
      "responsavel.")

    h2(pdf, "Autorizacao por propriedade (Phase 1)")
    p(pdf,
      "Funcao canEditResource(user, creatorId) -> admin OU criador do recurso. "
      "Aplicada nas rotas PATCH/DELETE de requisicoes, viagens, ordens de "
      "carregamento e movimentacoes. UI esconde botoes quando o usuario nao "
      "tem permissao (camada extra ao back-end).")

    h2(pdf, "Permissoes granulares (futuro)")
    p(pdf,
      "Tabelas permissions / role_permissions ja existem mas a interface ainda "
      "e simples. Roadmap previsto em replit.md inclui templates, hierarquia, "
      "dependencias automaticas e auditoria completa.")

    # -------- 8. Layout --------
    h1(pdf, "8. Layout, Componentes e Design System")

    h2(pdf, "Estrutura visual")
    p(pdf,
      "App segue layout sidebar + main. Sidebar lateral (shadcn) com grupos: "
      "Operacao, Estoque, Catalogo, Transporte, Relatorios, Configuracao. "
      "Header fino com botao de toggle da sidebar, breadcrumb implicito, sino "
      "de notificacoes e toggle de tema (dark/light).")

    h2(pdf, "Design system")
    kv(pdf, "Paleta", "Azul escuro (primary), azul claro, rosa (accent), roxo")
    kv(pdf, "Fonte", "Inter (300-700)")
    kv(pdf, "Estilo shadcn", "'New York' (mais denso e geometrico)")
    kv(pdf, "Border radius", "rounded-md (consistente)")
    kv(pdf, "Dark mode", "Implementado via class strategy (ThemeProvider)")
    kv(pdf, "Elevacao", "Utility hover-elevate / active-elevate-2")

    h2(pdf, "Componentes de UI mais usados")
    bullet(pdf, "Card  - container padrao para secoes e KPIs")
    bullet(pdf, "Table  - listagens densas (estilo ERP)")
    bullet(pdf, "Dialog / Sheet  - edicao e detalhes sem perder contexto")
    bullet(pdf, "Badge  - status coloridos (draft, pending, approved, rejected)")
    bullet(pdf, "Tabs  - secoes dentro da mesma pagina (ex: detalhes de evento)")
    bullet(pdf, "Form + Input + Select  - formularios reativos com Zod")
    bullet(pdf, "Toast  - feedback rapido de mutations")
    bullet(pdf, "Notification bell  - dropdown com nao-lidas")

    h2(pdf, "Padroes de UX")
    bullet(pdf, "Densidade alta (cabe muita info na tela - estilo ERP).")
    bullet(pdf, "Cores semanticas para status (verde/amarelo/vermelho/cinza).")
    bullet(pdf, "Tecla-primeiro: tabelas com foco e atalhos.")
    bullet(pdf, "Dialogs em vez de pages para acoes rapidas (criar/editar).")
    bullet(pdf, "Skeleton + isPending para feedback de carregamento.")

    # -------- 9. Features --------
    h1(pdf, "9. Features Importantes (Regras de Negocio)")

    h2(pdf, "Janela de requisicao por evento")
    p(pdf,
      "Cada evento define requestWindowStart / End. Submissao fora da janela "
      "e bloqueada com mensagem clara. Admin pode forcar.")

    h2(pdf, "Aprovacao parcial")
    p(pdf,
      "Supervisor pode aprovar quantidades por item (approvedQuantity menor "
      "que quantity). O sistema gera um 'request_audit_log' a cada decisao.")

    h2(pdf, "Explosao parametrica de kits")
    p(pdf,
      "Kit pode conter uma formula em bom_lines (ex: ceil(area / 4)). Quando "
      "a ordem de carregamento e gerada, o kit e expandido nos produtos finais "
      "agrupando duplicatas e mantendo a origem (kit X, requisicao Y).")

    h2(pdf, "Bin packing 3D para carregamento")
    p(pdf,
      "Algoritmo First-Fit Decreasing Height aloca itens no veiculo "
      "considerando peso e volume. Retorna sequencia de carregamento, "
      "ocupacao e alertas de excesso.")

    h2(pdf, "Roteamento por vizinho mais proximo")
    p(pdf,
      "Para viagens com varios destinos calcula sequencia otimizada, "
      "distancia, duracao estimada e gasto de combustivel.")

    h2(pdf, "Simulacao de estoque")
    p(pdf,
      "Cruza requisicoes pendentes/aprovadas com estoque atual e projeta "
      "faltas por data. Resultado classifica em FALTA / CRITICO / ADEQUADO "
      "com drill-down e export Excel.")

    h2(pdf, "Variantes e equivalencias")
    p(pdf,
      "Produtos de fornecedores diferentes podem mapear ao mesmo SKU "
      "principal. Movimentacoes resolvem automaticamente a SKU correta.")

    h2(pdf, "Tipos de movimento configuraveis")
    p(pdf,
      "Admin define grupos (entrada, saida, transferencia, manutencao) e "
      "tipos especificos com regras: aprovacao obrigatoria, fornecedor, "
      "status origem/destino permitidos, locais validos.")

    h2(pdf, "Notificacoes e @mentions")
    p(pdf,
      "Sistema in-app com sino no header. Suporta @mentions em comentarios. "
      "Painel de preferencias por canal e tipo.")

    h2(pdf, "Importacao em lote")
    p(pdf,
      "Eventos, produtos e plano de transporte podem ser importados via "
      "Excel. Preview, validacao linha-a-linha e relatorio de erros.")

    # -------- 10. Estado atual do layout --------
    h1(pdf, "10. Estado Atual do Layout / UX")

    h2(pdf, "Pontos positivos")
    bullet(pdf, "Sidebar bem organizada por grupos - facil encontrar paginas.")
    bullet(pdf, "Densidade boa para perfil operacional.")
    bullet(pdf, "Dark mode funcional em todas as paginas.")
    bullet(pdf, "Componentes shadcn consistentes (tipografia, espacamentos).")
    bullet(pdf, "Cores semanticas claras para status.")
    bullet(pdf, "Feedback visual em mutations (toast + estados isPending).")

    h2(pdf, "Pontos fracos identificados")
    bullet(pdf, "Tela de login (/auth) ainda renderiza com sidebar visivel - quebra a primeira impressao.")
    bullet(pdf, "Dashboard tem placeholder 'Conflitos' sem implementacao real.")
    bullet(pdf, "Rota /dashboard retorna 404 (so / funciona) - confunde usuario.")
    bullet(pdf, "Listagens grandes (requisicoes, movimentacoes) filtram tudo no front - lento com volume.")
    bullet(pdf, "Algumas tabelas nao tem ordenacao por coluna nem paginacao server-side.")
    bullet(pdf, "Falta empty-state amigavel em varias listas (so mostra tabela vazia).")
    bullet(pdf, "Mobile / tablet: layout assume desktop - tabelas estouram em telas menores.")
    bullet(pdf, "Modais muito grandes (criacao de requisicao) - poderiam ser pagina dedicada.")

    # -------- 11. Dividas tecnicas --------
    h1(pdf, "11. Pontos Fracos e Dividas Tecnicas")

    h2(pdf, "Back-end")
    bullet(pdf, "server/routes.ts com ~3100 linhas - precisa ser dividido por dominio.")
    bullet(pdf, "Mais de 40 'as any' espalhados - tipagem fraca em pontos criticos.")
    bullet(pdf, "shared/schema.ts com ~1600 linhas - dividir por agregados.")
    bullet(pdf, "Recuperacao de senha gera token mas nao envia e-mail (falta SMTP).")
    bullet(pdf, "Upload de imagens ainda usa filesystem local (pasta uploads/) em vez de Object Storage.")
    bullet(pdf, "Sistema de permissoes ainda simples (RBAC por role) - sem granularidade real.")

    h2(pdf, "Front-end")
    bullet(pdf, "Filtragem feita 100% no cliente em algumas paginas.")
    bullet(pdf, "Validacoes duplicadas (front e back) - bom para UX mas precisa sincronizar Zod.")
    bullet(pdf, "Alguns componentes muito grandes (>500 linhas) misturando logica e apresentacao.")
    bullet(pdf, "Falta storybook / catalogo visual - dificulta evolucao do design system.")
    bullet(pdf, "Testes praticamente inexistentes.")

    h2(pdf, "Operacional")
    bullet(pdf, "Sem testes automatizados.")
    bullet(pdf, "Sem CI configurado (lint, typecheck, build).")
    bullet(pdf, "Sem monitoramento (logs estruturados, metricas, alertas).")

    # -------- 12. Recomendacoes --------
    h1(pdf, "12. Recomendacoes Priorizadas")

    h3(pdf, "Curto prazo (1-2 sprints)")
    bullet(pdf, "Esconder sidebar na rota /auth e criar layout dedicado de login.")
    bullet(pdf, "Resolver rota /dashboard (alias para /) ou remover refs no codigo.")
    bullet(pdf, "Adicionar empty states ilustrados em todas as listagens.")
    bullet(pdf, "Configurar envio de e-mail (SendGrid via integration Replit) para reset de senha.")
    bullet(pdf, "Migrar uploads para Replit Object Storage.")
    bullet(pdf, "Implementar paginacao + ordenacao server-side nas listagens grandes.")

    h3(pdf, "Medio prazo (1-2 meses)")
    bullet(pdf, "Quebrar server/routes.ts por dominio (events.routes.ts, requests.routes.ts, etc.).")
    bullet(pdf, "Quebrar shared/schema.ts por agregado de negocio.")
    bullet(pdf, "Eliminar 'as any' progressivamente - tipar respostas de storage.")
    bullet(pdf, "Implementar Phase 2 de permissoes (templates, hierarquia, dependencias).")
    bullet(pdf, "Adicionar testes (Vitest no front, supertest no back) para fluxos criticos.")

    h3(pdf, "Longo prazo")
    bullet(pdf, "Responsividade real para tablet (operadores no almoxarifado).")
    bullet(pdf, "Storybook + tokens de design publicados.")
    bullet(pdf, "Observabilidade (logs estruturados, OpenTelemetry, dashboards).")
    bullet(pdf, "Internacionalizacao (i18n) - hoje misto PT/EN.")

    pdf.output("documentacao_eventflow.pdf")
    print("PDF gerado: documentacao_eventflow.pdf")


if __name__ == "__main__":
    main()
