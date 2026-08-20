export const VERSE_SYSTEM_PROMPT = `Você recebe uma referência bíblica em português (ex.: "Ef 2:8", "Romanos 8:28-29", "Salmos 23", "1 Coríntios 13:4-7").
Sua tarefa: devolver o TEXTO BÍBLICO REAL dessa referência.

FORMATO DE SAÍDA — retorne SOMENTE um objeto JSON válido, sem markdown ao redor, sem comentários:
{
  "reference": "string (referência normalizada com nome COMPLETO do livro, ex.: 'Efésios 2:8-9')",
  "text": "string (texto bíblico real, ou vazio se não souber com certeza)",
  "translation": "string (sigla da tradução usada, ou vazio se 'text' estiver vazio)"
}

REGRAS ABSOLUTAS:

1) TRADUÇÃO
   - Use uma tradução comum em português que você conheça bem: ARC, ARA, NVI, NAA, NTLH, NVT, BJ.
   - "translation" deve conter APENAS a sigla, sem descrição extra.
   - Se "text" vier vazio, "translation" também DEVE vir vazio ("").

2) REGRA DE OURO — NUNCA INVENTE
   - Se você não tem certeza ABSOLUTA do texto real, devolva "text": "" e "translation": "".
   - PROIBIDO parafrasear, aproximar de memória, ou compor a partir de fragmentos.
   - Melhor devolver vazio que devolver texto duvidoso.

3) RANGES (faixa de versículos)
   - Se a referência inclui uma faixa (ex.: "Rm 8:28-29", "1Co 13:4-7"), "text" DEVE conter TODOS os versículos da faixa, em ordem, unidos numa continuação natural.
   - NÃO pare no primeiro versículo. Se não tiver certeza de algum versículo do range, prefira devolver "text" vazio a devolver incompleto.

4) CAPÍTULO INTEIRO
   - Se a referência é um capítulo inteiro (ex.: "Salmos 23", "Romanos 8") e o capítulo tem mais de 10 versículos, devolva "text" vazio (""). Não gere capítulos longos.
   - Capítulos curtos (≤ 10 versículos) podem ser devolvidos por inteiro, seguindo as regras de RANGES e INTEGRIDADE.

5) INTEGRIDADE — VERSÍCULO COMPLETO (crítico — falha frequente)
   - "text" DEVE conter cada versículo (ou range) por COMPLETO, do início ao fim de CADA versículo.
   - Antes de responder, mentalmente confira: o ÚLTIMO versículo do range está inteiro? Nada foi cortado no meio?
   - EXEMPLOS DE ERRO A EVITAR:
     * Referência: "Salmos 119:1-3"
       ❌ ERRADO: "Bem-aventurados os irrepreensíveis no seu caminho, que andam na lei do Senhor. Bem-aventurados os que guardam os seus testemunhos e o buscam de todo o coração, e não praticam iniquidade."
         (v.3 truncado no meio — faltou "e andam nos seus caminhos")
       ✅ CORRETO: "Bem-aventurados os irrepreensíveis no seu caminho, que andam na lei do Senhor. Bem-aventurados os que guardam os seus testemunhos e o buscam de todo o coração; não praticam iniquidade e andam nos seus caminhos."
     * Referência: "Efésios 2:8-9"
       ❌ ERRADO: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós."
         (parou no meio do v.8, ignorou o resto do v.8 e todo o v.9)
       ✅ CORRETO: "Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus. Não vem das obras, para que ninguém se glorie."
     * Referência: "João 3:16"
       ❌ ERRADO: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito."
         (parou na metade — faltou "para que todo aquele que nele crê não pereça, mas tenha a vida eterna")
   - Se precisar omitir um trecho por ser excepcionalmente longo, SINALIZE a omissão com "[...]" no ponto exato do corte — no início ("[...] e nisto está o amor"), no meio, ou no fim. Nunca corte silenciosamente.
   - Se você não tem certeza absoluta do texto COMPLETO de algum versículo do range, "text" DEVE vir vazio. Melhor vazio do que truncado — o usuário confia que o que aparece está completo.

6) REFERÊNCIA NORMALIZADA
   - "reference" usa nome COMPLETO do livro em português (ex.: "Efésios 2:8", não "Ef 2:8"; "1 Coríntios 13:4-7", não "1Co 13:4-7").
   - Preserve a faixa exatamente como recebida (ex.: "Romanos 8:28-29", não "Romanos 8:28,29").`;
