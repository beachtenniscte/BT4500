# Sistema de Pontuação por IDs de Classificação

## Conceito

O sistema usa **IDs de classificação (1-6)** para abstrair os diferentes formatos de torneio. Cada posição final num torneio mapeia para um ID, independentemente do formato usado.

## Pontuações por ID (Época 2025)

| ID | OURO N1 | PRATA N1 | BRONZE N1 | OURO N2 | PRATA N2 | BRONZE N2 |
|----|---------|----------|-----------|---------|----------|-----------|
| 1  | 1500    | 750      | 375       | 444     | 222      | 111       |
| 2  | 1000    | 500      | 250       | 296     | 148      | 74        |
| 3  | 667     | 333      | 167       | 198     | 99       | 49        |
| 4  | 444     | 222      | 111       | 132     | 66       | 33        |
| 5  | 296     | 148      | 74        | 88      | 44       | 22        |
| 6  | 15      | 15       | 15        | 15      | 15       | 15        |

**Nota**: ID 6 (ULTIMO/eliminado com 0 vitórias) tem pontuação fixa de **15 pontos** para todos os tiers/levels.

## Regra de Eliminação

- **Eliminado com 0 vitórias** → ID 6 (15 pontos)
- **Eliminado com 1+ vitórias** → ID baseado na ronda (SF=3, QF=4, R16=5)

Esta regra aplica-se a **todos os formatos de torneio**.

## Formatos N1 (Nível 1 OURO/PRATA)

| Equipas | Formato | V | F | SF | 2ºG | PEN | ULT |
|---------|---------|---|---|----|----|-----|-----|
| 8+ | Eliminação | 1 | 2 | 3 | 4 | 5 | 6 |
| 7 | 1G3 + 1G4 + Final | 1 | 2 | - | 3 | 4 | 6 |
| 6 | 2 G3 + Final | 1 | 2 | - | - | 3 | 6 |
| 5 | 1 G5 | 1 | - | - | 2 | 4 | 6 |
| 4 | 1 G4 | 1 | - | - | 2 | 3 | 6 |
| 3 | 1 G3 | 1 | - | - | - | 2 | 6 |

## Formatos N2 (Nível 2) e N1 BRONZE

| Equipas | Formato | Apuramento | V | F | SF | 2ºG | PEN | ULT |
|---------|---------|------------|---|---|----|----|-----|-----|
| 12 | 4 G3 | 4×1ºs → SF | 1 | 2 | 3 | - | 4 | 6 |
| 11 | 2G4 + 1G3 | 3×1ºs + melhor 2º → SF | 1 | 2 | 3 | 4 | 5 | 6 |
| 10 | 1G4 + 2G3 | 3×1ºs + melhor 2º → SF | 1 | 2 | 3 | 4 | 5 | 6 |
| 9 | 3 G3 | 3×1ºs + melhor 2º → SF | 1 | 2 | 3 | - | 4 | 6 |
| 8 | 2 G4 | 2×1ºs → Final | 1 | 2 | - | 3 | 4 | 6 |
| 7 | 1G3 + 1G4 | 2×1ºs → Final | 1 | 2 | - | 3 | 4 | 6 |
| 6 | 2 G3 | 2×1ºs → Final | 1 | 2 | - | - | 3 | 6 |
| 5 | 1 G5 | Grupo único | 1 | - | - | 2 | 4 | 6 |
| 4 | 1 G4 | Grupo único | 1 | - | - | 2 | 3 | 6 |
| 3 | 1 G3 | Grupo único | 1 | - | - | - | 2 | 6 |

**Legenda**: V=Vencedor, F=Finalista, SF=Semifinalista, 2ºG=2º do Grupo, PEN=Penúltimo, ULT=Último

## Regras de Apuramento

### Por número de grupos:
- **4 Grupos**: 4 vencedores de grupo → Semifinais
- **3 Grupos**: 3 vencedores + **melhor 2º classificado** → Semifinais (4 equipas)
- **2 Grupos**: 2 vencedores → Final directa
- **1 Grupo**: Sem playoffs, classificação directa

### Melhor 2º Classificado (3 grupos)
Quando há 3 grupos (9-11 inscrições), o **melhor 2º classificado** avança às semifinais junto com os 3 vencedores. Critérios de desempate:
1. Vitórias
2. Diferença de sets
3. Diferença de games
4. Games ganhos

## Migração SQL

Executar: `backend/migrations/update_points_2025.sql`

```sql
-- Actualiza ID 6 para 15 pontos fixos
DELETE FROM points_table WHERE season = 2025;
-- Insere novos valores (ver ficheiro completo)
```

## Ficheiros de Referência

- `classificacao/N1.csv` - Formatos para Nível 1
- `classificacao/N2.csv` - Formatos para Nível 2
- `classificacao/Pontuações.csv` - Pontuações por tier/level/ID
- `backend/src/services/PointsService.js` - Lógica de cálculo
