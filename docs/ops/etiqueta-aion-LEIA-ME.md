# Etiqueta de equipamento AION — briefing para o Cursor

Gerador de etiquetas para a **Nimbot B1**: faixa preta com o logo AION em branco, ID grande na horizontal, datas, testes em checkbox e QR grande.

## Impressora e tamanho
- Nimbot B1: 203 dpi = **8 pontos/mm**, monocromática.
- Etiqueta **50 × 30 mm → 400 × 240 pt**, impressa deitada.
- Renderize no tamanho exato em pontos e converta para **1 bit, limiar 50%**. Sem cinza nem antialias.
- O módulo do QR deve ser número inteiro de pontos (5 pt) para sair nítido.

## Layout (400 × 240 pt, coordenadas em pontos, origem no canto superior esquerdo)
| Bloco | Posição | Detalhes |
|---|---|---|
| Faixa da marca | x 0–85, y 0–240 | **Preto sólido de ponta a ponta.** Logo AION em **branco**, girado 90° anti-horário (lê de baixo para cima), 210 pt de comprimento, centrado na faixa |
| ID | x 97–390, y 8–60 | "EQUIP. Nº" 10 pt/600 (+1,5 pt espaço) à esquerda; "HSJ-00001" **47 pt/800** alinhado à direita; linha de 3 pt embaixo |
| REALIZADO | x 97–235, y 70–94 | "REALIZADO" 9 pt/700 à esquerda, data 21 pt/700 à direita, linha de 1 pt embaixo |
| PRÓXIMO | x 97–235, y 97–127 | **Caixa preta**, cantos 6 pt: "PRÓXIMO" 9 pt/800 e data **26 pt/800** em branco |
| Testes | x 97–235, y 137–207 | **Chips um embaixo do outro**, 22 pt de altura, espaço 3 pt, cantos 5 pt. Checkbox 13 × 13 pt + sigla 15 pt. **Feito:** borda 2 pt, checkbox preto com ✓ branco, sigla 800. **Não feito:** borda tracejada 1 pt, checkbox vazio (contorno 2 pt), sigla 600 |
| Contato | x 97–235, y 220–230 | "(16) 3030-0445 · aion.eng.br" 10 pt/600 |
| QR | x 245–390, y 70–215 | **145 × 145 pt, 5 pt por módulo** (QR versão 3 = 29 módulos). O fundo branco ao redor serve de zona livre |
| Lacre | x 245–390, y 220–230 | "VOID IF SEAL IS BROKEN" 8 pt/700, +1,5 pt espaço, centralizado |

A B1 pode deixar ~1 mm branco na borda da faixa preta; isso é normal.

## Dados
```json
{
  "id": "HSJ-00001",
  "realizado": "07/26",
  "proximo": "07/27",
  "testes": [
    { "sigla": "M.P",   "feito": true },
    { "sigla": "CAL.",  "feito": true },
    { "sigla": "T.S.E", "feito": false }
  ],
  "qr": "<URL do equipamento>",
  "telefone": "(16) 3030-0445",
  "site": "www.aion.eng.br"
}
```
- Os chips seguem a ordem da lista, um embaixo do outro. Para mais de 3 testes, reduza a altura dos chips para caber em y 137–207.

## Regras
- Fonte: **Barlow Condensed** (Google Fonts) para todo o texto.
- QR: correção de erro **M**, zona livre ≥ 2 módulos.
- Branco sobre preto só com peso ≥ 700. Nenhum texto abaixo de 8 pt.

## Arquivos de referência nesta pasta
- `etiqueta-aion.html`: o layout pronto em HTML/CSS (escala 2×). Use como fonte da verdade para posições, tamanhos e estilos.
- `etiqueta-nimbot-400x240.png`: o bitmap final esperado, 1 bit, 400×240 pt. O resultado do gerador deve ficar igual a este.
- `etiqueta-preview-2x.png`: prévia em alta resolução.
