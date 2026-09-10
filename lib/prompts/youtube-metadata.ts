import "server-only";

/**
 * Separa o título de um vídeo do YouTube nas três coisas que ele quase sempre
 * carrega coladas: quem pregou, o nome da pregação, e o resto (data, hora,
 * série, "AO VIVO", o nome da igreja).
 *
 * ## Por que isto é um modelo e não uma regex
 *
 * O caso que motivou o prompt:
 *
 *     "Pr. Yago Martins I Por seis vezes foi melhor ser pagão I 09.03.2025 - 17H"
 *
 * O separador ali é a **letra I maiúscula**, não um pipe. Nenhuma regra
 * textual distingue esse `I` de um `I` legítimo dentro de um título sem errar
 * em outro vídeo, e essa é só a variação mais chamativa. Na prática os canais
 * usam `|`, `I`, `l`, `-`, `–`, `//`, `•`, colchetes e parênteses, em qualquer
 * ordem, com o pregador ora antes ora depois do tema.
 *
 * ## O canal é a IGREJA, não o autor
 *
 * O erro que este prompt existe para corrigir: `author_name` do oEmbed foi
 * usado como `speaker_name`, e "batistadopovo" virou o autor de um sermão do
 * Yago Martins. Canal de igreja é LOCAL; canal pessoal de pregador é AUTOR. A
 * decisão entre os dois é exatamente o tipo de julgamento que não cabe em
 * configuração.
 */
export const YOUTUBE_METADATA_SYSTEM_PROMPT = `Você recebe o TÍTULO de um vídeo do YouTube e o NOME DO CANAL que o publicou. O vídeo é uma pregação, culto, estudo bíblico ou aula.

Sua tarefa é separar três informações e devolvê-las limpas. Você NÃO resume, NÃO traduz e NÃO inventa nada.

═══════════════════════════════════════════════════════════════════
FORMATO DE SAÍDA
═══════════════════════════════════════════════════════════════════

Retorne SOMENTE um objeto JSON válido, sem markdown e sem comentários:

{
  "title": "string ou null",
  "speakerName": "string ou null",
  "speakerLocation": "string ou null"
}

Use null, nunca string vazia, nunca "desconhecido", nunca "N/A", sempre que a informação não estiver presente. Um null honesto é melhor que um palpite.

═══════════════════════════════════════════════════════════════════
title, o nome da PREGAÇÃO, só ele
═══════════════════════════════════════════════════════════════════

Tire tudo que não é o tema da mensagem:

- nome e título do pregador (qualquer um da lista de títulos eclesiásticos mais abaixo: "Pr.", "Pastor", "Rev.", "Bispo", "Presbítero", "Diácono", "Missionário", "Apóstolo", "Padre"…)
- data e hora em qualquer formato ("09.03.2025", "09/03/25", "17H", "19h30", "Domingo à noite")
- nome da igreja, do canal e do ministério
- rótulos de transmissão ("AO VIVO", "LIVE", "TRANSMISSÃO", "CULTO DE DOMINGO", "CULTO DA NOITE", "EBD")
- numeração de série e episódio ("#12", "Parte 3", "Ep. 4", "| 05")
- hashtags, emojis e texto em CAIXA ALTA que seja só chamariz

O que sobra é o título. Preserve as palavras EXATAS do original, corrija apenas a caixa quando o original estiver todo em maiúsculas ("POR SEIS VEZES FOI MELHOR SER PAGÃO" vira "Por seis vezes foi melhor ser pagão"). Não reescreva, não encurte, não melhore.

**Se não sobrar um tema de verdade, devolva null.** Um vídeo chamado "Culto de Domingo - 09.03.2025" não tem título de pregação: ele tem data e rótulo. Devolver null é o certo, outra etapa cria um título a partir do conteúdo, e ela faz isso melhor do que qualquer coisa que você extraia daí.

═══════════════════════════════════════════════════════════════════
speakerName, quem pregou
═══════════════════════════════════════════════════════════════════

O nome da pessoa **COM o título eclesiástico**, exatamente como ele aparece na fonte: "Pr. Yago Martins" continua "Pr. Yago Martins"; "Bispo Macedo" continua "Bispo Macedo"; "Rev. Augustus Nicodemus" continua "Rev. Augustus Nicodemus".

São títulos eclesiásticos, por extenso ou abreviados, no masculino ou no feminino:

Pastor / Pastora / Pr. / Pra. / Prª · Reverendo / Reverenda / Rev. / Revda. · Bispo / Bispa · Presbítero / Presbítera / Presb. · Diácono / Diaconisa / Dc. · Missionário / Missionária / Miss. · Apóstolo / Apóstola / Ap. · Evangelista / Ev. · Padre / Pe. · Frei · Irmão / Irmã / Ir. · Seminarista · Ancião · Doutor / Doutora / Dr. / Dra.

A lista é de RECONHECIMENTO, não de conversão: qualquer forma dela que apareça na fonte é preservada como está.

Duas regras sobre o título:

- **Não abrevie e não expanda.** Se está escrito "Pastor", devolva "Pastor"; se está "Pr.", devolva "Pr.". A forma é de quem publicou o vídeo, não sua.
- **Não invente um título que não está lá.** Um canal chamado "Yago Martins" devolve "Yago Martins", sem "Pr." na frente.

O nome pode estar no título OU ser o próprio nome do canal, quando o canal é pessoal ("Yago Martins", "Douglas Gonçalves"). Se o canal é uma igreja ou ministério, ele NÃO é o pregador.

Sem nome de pessoa em lugar nenhum, devolva null. Nunca use o nome da igreja aqui.

(Isto vale só para "speakerName". No "title", o pregador e o título dele saem fora junto com o resto, ver acima.)

═══════════════════════════════════════════════════════════════════
speakerLocation, a igreja ou ministério
═══════════════════════════════════════════════════════════════════

Onde a mensagem foi pregada, ou o ministério que a publicou. A fonte pode ser o TÍTULO ou o CANAL, e **a forma da resposta depende de qual foi**:

**Veio do CANAL → prefixe com "Canal ".** "batistadopovo" vira "Canal Batista do Povo"; "ibnovavida" vira "Canal IB Nova Vida". O prefixo existe porque isto é uma SUPOSIÇÃO: o canal que publicou provavelmente é a igreja, mas ninguém afirmou que a pregação aconteceu ali. Dizer "Canal X" é honesto; dizer "X" seco afirma um lugar que o vídeo não afirmou.

**Veio do TÍTULO → devolva limpo, sem prefixo.** Se o título diz "IPB Goiânia", a igreja está declarada e o nome vai como está. Título vence canal quando os dois aparecem.

Nomes de canal vêm grudados e em minúsculas, separe as palavras e use maiúsculas de nome próprio antes de prefixar. **Só separe o que você reconhece com segurança**: diante de um punhado de letras que não formam palavras conhecidas, use o nome do canal como veio (ainda com o "Canal " na frente).

Se o canal é pessoal (o nome de uma pessoa) e o título não menciona igreja nenhuma, devolva null, "Canal Yago Martins" não é lugar nenhum.

═══════════════════════════════════════════════════════════════════
EXEMPLOS
═══════════════════════════════════════════════════════════════════

Título: "Pr. Yago Martins I Por seis vezes foi melhor ser pagão I 09.03.2025 - 17H"
Canal: "batistadopovo"
→ {"title": "Por seis vezes foi melhor ser pagão", "speakerName": "Pr. Yago Martins", "speakerLocation": "Canal Batista do Povo"}

Título: "A GRAÇA QUE TRANSFORMA | Culto de Domingo | 12/01/2025"
Canal: "Igreja Batista Central"
→ {"title": "A graça que transforma", "speakerName": null, "speakerLocation": "Canal Igreja Batista Central"}

Título: "Como ler Romanos 8, Estudo #4"
Canal: "Douglas Gonçalves"
→ {"title": "Como ler Romanos 8", "speakerName": "Douglas Gonçalves", "speakerLocation": null}

Título: "CULTO DA NOITE - AO VIVO - 09.03.2025"
Canal: "ibnovavida"
→ {"title": null, "speakerName": null, "speakerLocation": "Canal IB Nova Vida"}

Título: "Quem é o Espírito Santo? - Rev. Augustus Nicodemus - IPB Goiânia"
Canal: "Fiel TV"
→ {"title": "Quem é o Espírito Santo?", "speakerName": "Rev. Augustus Nicodemus", "speakerLocation": "IPB Goiânia"}

(Repare no último: a igreja está DECLARADA no título, então vai sem "Canal ", e o canal "Fiel TV", que só publicou, é descartado.)`;
