from fpdf import FPDF
import textwrap

class PDF(FPDF):
    def header(self):
        self.set_fill_color(15, 52, 96)
        self.rect(0, 0, 210, 18, "F")
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(255, 255, 255)
        self.set_xy(10, 4)
        self.cell(0, 10, "EventFlow Logistics - Como o Sistema Funciona", ln=True)
        self.set_text_color(0, 0, 0)
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f"Pagina {self.page_no()}", align="C")

    def section(self, title):
        self.set_fill_color(233, 69, 96)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 12)
        self.ln(4)
        self.cell(0, 8, "  " + title, ln=True, fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

    def subsection(self, title):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(15, 52, 96)
        self.ln(2)
        self.cell(0, 7, title, ln=True)
        self.set_text_color(0, 0, 0)

    def body(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(1)

    def bullet(self, text):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(40, 40, 40)
        self.set_x(14)
        self.cell(5, 6, chr(149), ln=False)
        self.multi_cell(0, 6, text)

    def box(self, text, color=(240, 244, 255)):
        self.set_fill_color(*color)
        self.set_draw_color(15, 52, 96)
        self.set_font("Helvetica", "", 10)
        self.set_text_color(20, 20, 60)
        self.multi_cell(0, 6, text, border=1, fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(2)

pdf = PDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.add_page()

# Titulo
pdf.set_font("Helvetica", "B", 18)
pdf.set_text_color(15, 52, 96)
pdf.ln(2)
pdf.cell(0, 12, "EventFlow Logistics", ln=True)
pdf.set_font("Helvetica", "", 12)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 8, "Guia completo de logica operacional - Como o sistema funciona", ln=True)
pdf.ln(4)

# 1
pdf.section("1. A Ideia Central do Sistema")
pdf.body("O EventFlow e organizado ao redor de eventos. Um evento pode ser um show, uma feira, uma exposicao ou qualquer acontecimento que precise de materiais e logistica. Tudo no sistema - pedidos, carregamentos, viagens, movimentacoes de estoque - esta ligado a um evento especifico.")
pdf.body("A grande vantagem dessa abordagem e que da para saber, a qualquer momento, quais materiais foram pedidos para qual evento, quem os separou, em qual caminhao foram, e se voltaram corretamente ao estoque depois.")
pdf.box("Resumo do fluxo central:\nEvento --> Pedido de materiais --> Aprovacao --> Separacao no armazem --> Carregamento no veiculo --> Transporte --> Devolucao ao estoque.")

# 2
pdf.section("2. Cadastro de Eventos")
pdf.body("Antes de qualquer coisa, o evento precisa existir no sistema. No cadastro, sao definidas tres datas importantes:")
pdf.bullet("Data de montagem - quando a equipe comeca a montar o cenario e precisa dos materiais no local.")
pdf.bullet("Data do evento - quando o evento acontece de fato.")
pdf.bullet("Data de desmontagem - quando tudo precisa ser recolhido e devolvido ao armazem.")
pdf.ln(2)
pdf.body("Alem das datas, define-se um prazo de corte: e o ultimo dia em que as equipes podem fazer pedidos de materiais para esse evento. Apos esse prazo, o sistema bloqueia novos pedidos automaticamente. Isso evita surpresas de ultima hora para o armazem.")

# 3
pdf.section("3. Pedidos de Materiais")
pdf.body("Com o evento criado, as equipes (cenografia, producao, operacao, etc.) fazem seus pedidos de materiais. Cada pedido diz: Para o evento X, na area Y, eu preciso dos seguintes itens.")
pdf.subsection("Fluxo de aprovacao do pedido")
pdf.bullet("1. Rascunho - O solicitante monta a lista de itens e ainda pode editar livremente.")
pdf.bullet("2. Pendente - O pedido e enviado para aprovacao. Nao pode mais ser editado pelo solicitante.")
pdf.bullet("3. Aprovado ou Rejeitado - O responsavel analisa e decide. Pode aprovar tudo, aprovar alguns itens (aprovacao parcial) ou rejeitar tudo.")
pdf.ln(2)
pdf.body("Na aprovacao parcial, o aprovador entra item a item e decide quais quantidades liberar. Se um item for reduzido ou negado, o solicitante ve claramente o que foi aprovado versus o que foi pedido.")

# 4
pdf.section("4. Produtos e Kits (Materiais do Armazem)")
pdf.body("O sistema mantem um catalogo de todos os produtos disponiveis. Cada produto tem peso, dimensoes, quantidade em estoque e tipo de posse (se e proprio, alugado ou de terceiros).")
pdf.body("Alem dos produtos individuais, existem os kits. Um kit e uma combinacao de produtos. Por exemplo, 'Kit Palco A' pode conter 10 estruturas metalicas, 4 paineis de LED e 2 suportes. Quando alguem pede um kit, o sistema automaticamente expande isso nos itens individuais na hora de montar a lista de separacao.")
pdf.box("Variantes e equivalencias: O sistema permite cadastrar produtos equivalentes. Se um produto de um fornecedor for identico ao produto principal, eles podem ser vinculados. Isso ajuda na rastreabilidade e na substituicao quando necessario.", (240, 255, 244))

# 5
pdf.section("5. Ordens de Carregamento")
pdf.body("Depois que os pedidos sao aprovados, eles precisam sair do armazem. A Ordem de Carregamento consolida todos os pedidos aprovados de um evento em uma unica lista de separacao (picking list). O armazenista usa essa lista para coletar os itens nas prateleiras.")
pdf.body("Se dois pedidos diferentes pediram o mesmo produto, eles aparecem agrupados na lista, mostrando a quantidade total e de onde cada parte vem. O sistema acompanha o progresso da separacao em tempo real.")
pdf.subsection("Otimizacao de carregamento")
pdf.body("O sistema tem uma funcionalidade inteligente que analisa o peso e o volume de todos os itens e sugere a ordem ideal de carregamento no veiculo - quais itens vao primeiro (mais pesados e maiores no fundo), quais ficam por cima. Isso maximiza o uso do espaco e evita danos.")

# 6
pdf.section("6. Transporte e Viagens")
pdf.body("Com os materiais separados, e hora de planejar o transporte. O sistema gerencia viagens com: veiculo, motorista, destinos com sequencia de paradas e horarios previstos.")
pdf.subsection("Otimizacao de rotas")
pdf.body("Para viagens com multiplas paradas, o sistema calcula automaticamente a melhor ordem para visitar os destinos, estimando a distancia total, o tempo de viagem e o consumo de combustivel. As viagens podem ser visualizadas em lista ou em um calendario visual.")

# 7
pdf.section("7. Movimentacoes de Estoque")
pdf.body("Cada vez que um produto entra, sai ou muda de lugar no armazem, isso e registrado como uma movimentacao. O sistema distingue tres tipos principais:")
pdf.bullet("Entrada - Produto chegando ao armazem (ex: devolucao apos evento, compra nova).")
pdf.bullet("Saida - Produto saindo do armazem (ex: carregamento para evento).")
pdf.bullet("Transferencia interna - Produto mudando de local dentro do armazem.")
pdf.ln(2)
pdf.body("Cada tipo de movimentacao define como afeta os diferentes contadores de estoque: o fisico (o que realmente esta no armazem), o operacional (o que esta comprometido para eventos) e o patrimonial (para fins contabeis).")
pdf.subsection("Aprovacao de movimentacoes sensiveis")
pdf.body("Algumas movimentacoes como baixas por perda ou descarte requerem aprovacao antes de serem confirmadas. Isso garante controle sobre operacoes que afetam o patrimonio.")

# 8
pdf.section("8. Devolucoes")
pdf.body("Apos o evento, os materiais precisam voltar ao armazem. O modulo de devolucoes registra o retorno de cada item, permitindo confirmar quais voltaram, registrar itens danificados (com descricao do dano), registrar perdas (itens que nao voltaram) e dar baixa no estoque.")
pdf.body("Esse rastreamento e fundamental para controle patrimonial e para cobrar responsabilidades em caso de danos ou perdas.")

# 9
pdf.section("9. Simulacao e Relatorios")
pdf.body("O sistema tem uma funcionalidade de simulacao de estoque. Ele olha para todos os eventos futuros, soma todas as necessidades de materiais aprovadas, e compara com o estoque atual. O resultado mostra proativamente:")
pdf.bullet("ADEQUADO - Tem estoque suficiente para atender o evento.")
pdf.bullet("CRITICO - O estoque esta baixo, ha risco.")
pdf.bullet("FALTA - Nao tem estoque suficiente. E necessario providenciar o material.")
pdf.ln(2)
pdf.body("Isso permite que o time de logistica se antecipe a problemas antes que eles acontecam, em vez de descobrir a falta de material na vespera do evento. Os relatorios podem ser exportados para Excel.")

# 10
pdf.section("10. Controle de Acesso e Usuarios")
pdf.subsection("Cadastro e aprovacao")
pdf.body("Novos usuarios se cadastram, mas so conseguem acessar o sistema apos um administrador aprovar o cadastro. Isso evita acessos nao autorizados.")
pdf.subsection("Papeis e permissoes")
pdf.body("Cada usuario tem um papel (ex: Operador de Armazem, Supervisor, Gestor de Logistica, Administrador). Cada papel define o que o usuario pode ver, criar, editar e excluir em cada modulo.")
pdf.subsection("Regra de propriedade")
pdf.body("Cada recurso pertence a quem o criou. Um pedido criado por Maria so pode ser editado ou excluido pela propria Maria ou por um administrador. Isso evita que pessoas alterem o trabalho dos outros por acidente.")

# 11
pdf.section("11. Notificacoes")
pdf.body("O sistema avisa os usuarios sobre eventos importantes atraves de notificacoes internas. E possivel mencionar outros usuarios em comentarios usando @nome, e a pessoa mencionada recebe uma notificacao. Cada usuario pode configurar quais tipos de notificacao deseja receber.")

# 12
pdf.section("12. Importacoes em Massa")
pdf.body("Para facilitar o cadastro de muitos dados de uma vez, o sistema aceita importacao via planilha Excel para: cadastro de eventos, cadastro de produtos e planejamento de transporte. O sistema valida os dados antes de importar e mostra um relatorio de erros, linha por linha, caso alguma informacao esteja incorreta.")

# Resumo
pdf.ln(2)
pdf.section("Resumo Geral - O Ciclo Completo de um Evento")
steps = [
    "1. Cadastrar o evento com datas e prazo de corte",
    "2. Equipes fazem pedidos de materiais dentro do prazo",
    "3. Supervisores aprovam os pedidos (total ou parcialmente)",
    "4. Armazem recebe a ordem de carregamento e separa os itens",
    "5. Logistica planeja a viagem com veiculo e motorista",
    "6. Materiais sao carregados e transportados ao local do evento",
    "7. Evento acontece",
    "8. Equipe registra a devolucao dos materiais, incluindo danos ou perdas",
    "9. Estoque e atualizado automaticamente",
    "10. Relatorios ficam disponiveis para analise posterior",
]
for s in steps:
    pdf.bullet(s)

pdf.output("/home/runner/workspace/resumo_eventflow.pdf")
print("PDF gerado com sucesso!")