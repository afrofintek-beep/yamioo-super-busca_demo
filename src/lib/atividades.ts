// Taxonomia de atividades por tipo — do informal africano ao moderno.
// Facilita o registo (toca em vez de escrever) e padroniza as categorias
// (melhor pesquisa, menos duplicados, INY por atividade, sinal p/ Kilapi).

export const ATIVIDADES: Record<string, string[]> = {
  local: [
    "Quitanda", "Mercearia", "Mini-mercado", "Supermercado", "Banca de rua",
    "Zungueira (venda ambulante)", "Kinguila (câmbio)", "Farmácia", "Padaria",
    "Talho", "Peixaria", "Frutaria / hortaliça", "Restaurante", "Café",
    "Bar / botequim", "Take-away / comida de rua", "Salão de beleza", "Barbearia",
    "Loja de roupa", "Loja de calçado", "Papelaria", "Quiosque", "Cyber café",
    "Loja de telemóveis", "Ferragens", "Material de construção", "Loja de móveis",
    "Ótica", "Clínica", "Escola / explicações", "Creche", "Ginásio",
    "Hotel / pensão", "Lavandaria", "Posto de combustível", "Casa de câmbios",
    "Agência de viagens", "Floricultura", "Boutique", "Perfumaria",
  ],
  servico: [
    "Sapateiro", "Alfaiate / costureira", "Canalizador", "Eletricista",
    "Mecânico auto", "Bate-chapa / pintura auto", "Soldador",
    "Marceneiro / carpinteiro", "Pedreiro", "Pintor de construção",
    "Técnico de frigoríficos / AC", "Técnico de telemóveis",
    "Informático / reparação PC", "Jardineiro", "Empregada doméstica",
    "Mototáxi (kupapata)", "Táxi", "Transporte / frete", "Carregador (roboteiro)",
    "Lavagem de carros", "Engraxador", "Fotógrafo / vídeo", "DJ / som",
    "Decoração de eventos", "Catering / comida por encomenda",
    "Explicador / professor particular", "Manicure / pedicure",
    "Cabeleireira ao domicílio", "Estética", "Massagista", "Serralheiro",
    "Vidraceiro", "Dedetização", "Contabilista", "Advogado", "Tradutor",
    "Design gráfico", "Marketing / redes sociais", "Reparação de electrodomésticos",
  ],
  pessoa: [
    "Médico", "Enfermeiro(a)", "Parteira", "Professor(a)", "Motorista",
    "Segurança / guarda", "Cozinheiro(a)", "Técnico", "Artista / músico",
    "Costureira", "Agricultor", "Pescador", "Criador de gado",
    "Líder religioso", "Curandeiro tradicional", "Comerciante",
  ],
  oportunidade: [
    "Emprego", "Biscate / trabalho pontual", "Estágio", "Aluguer de casa / quarto",
    "Aluguer de espaço comercial", "Venda de terreno", "Venda de casa",
    "Parceria de negócio", "Investimento", "Formação / curso", "Concurso público",
  ],
  conteudo: [
    "Notícia local", "Evento / festa", "Anúncio / classificado",
    "Formação / workshop", "Promoção", "Aviso comunitário", "Vaga divulgada",
  ],
};

export function atividadesPara(tipo: string): string[] {
  return ATIVIDADES[tipo] ?? ATIVIDADES.local;
}
