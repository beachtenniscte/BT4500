# BT4500 - Sistema de Gestão de Torneios de Beach Tennis

## Visão Geral

Aplicação web para gestão de torneios de beach tennis com:
- Frontend: React + Vite
- Backend: Node.js + Express
- Base de dados: MS SQL Server
- Autenticação: Auth0 (Google OAuth)

## Sistema de Pontuação

### Conceito Principal

O sistema usa **IDs de classificação (1-6)** para abstrair os diferentes formatos de torneio. Cada posição final num torneio mapeia para um ID, independentemente do formato usado.

### Épocas (Seasons)

O sistema suporta **pontuações diferentes por época/ano**:
- **2025**: Níveis 1 e 2 (configuração actual)
- **2026**: Níveis 1, 2 e **3** (novo nível a adicionar)

Os pontos são determinados pelo ano do torneio (`tournaments.year`).

### Formatos de Torneio

Os torneios têm formatos diferentes dependendo do **número de equipas** e do **nível** (N1 ou N2).

#### Regra de Eliminação (todos os formatos)

- **Eliminado com 0 vitórias** → ID 6 (15 pontos)
- **Eliminado com 1+ vitórias** → ID baseado na ronda (SF=3, QF=4, R16=5)

#### Nível 1 OURO/PRATA (N1)

| Equipas | Formato | Classificações |
|---------|---------|----------------|
| 8+ | Eliminação directa | V=1, F=2, SF=3, QF=4, R16=5, 0-wins=6 |
| 7 | 1 G3 + 1 G4 + Final | V=1, F=2, 2ºG=3, PENULTIMO=4, ULTIMO=6 |
| 6 | 2 G3 + Final | V=1, F=2, PENULTIMO=3, ULTIMO=6 |
| 5 | 1 G5 | 1ºG=1, 2ºG=2, 3ºG=3, PENULTIMO=4, ULTIMO=6 |
| 4 | 1 G4 | 1ºG=1, 2ºG=2, PENULTIMO=3, ULTIMO=6 |
| 3 | 1 G3 | 1ºG=1, PENULTIMO=2, ULTIMO=6 |

#### Nível 2 (N2) e Nível 1 BRONZE

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

#### Regras de Apuramento

- **4 Grupos**: 4 vencedores de grupo → Semifinais
- **3 Grupos**: 3 vencedores + **melhor 2º classificado** → Semifinais (4 equipas)
- **2 Grupos**: 2 vencedores → Final directa
- **1 Grupo**: Sem playoffs, classificação directa

O **melhor 2º classificado** (em formatos de 3 grupos) é determinado pelos critérios de desempate:
1. Vitórias
2. Confronto directo (se aplicável)
3. Diferença de sets
4. Diferença de games

### Pontuações por ID de Classificação (Época 2025)

| ID | OURO N1 | PRATA N1 | BRONZE N1 | OURO N2 | PRATA N2 | BRONZE N2 |
|----|---------|----------|-----------|---------|----------|-----------|
| 1  | 1500    | 750      | 375       | 444     | 222      | 111       |
| 2  | 1000    | 500      | 250       | 296     | 148      | 74        |
| 3  | 667     | 333      | 167       | 198     | 99       | 49        |
| 4  | 444     | 222      | 111       | 132     | 66       | 33        |
| 5  | 296     | 148      | 74        | 88      | 44       | 22        |
| 6  | 15      | 15       | 15        | 15      | 15       | 15        |

**Nota**: ID 6 (ULTIMO) tem pontuação fixa de 15 pontos para todos os tiers/levels.

**Nota**: Para adicionar pontuações de 2026 ou Nível 3, editar `backend/migrations/update_points_classification_id.sql` ou inserir directamente na tabela `points_table` com o `season` apropriado.

### Tiebreakers para Fase de Grupos

Quando equipas empatam em vitórias num grupo, usar por ordem:
1. Confronto directo (head-to-head)
2. Diferença de sets
3. Diferença de games
4. Games ganhos

### Ficheiros de Referência

- `classificacao/N1.csv` - Formatos para Nível 1
- `classificacao/N2.csv` - Formatos para Nível 2
- `classificacao/Pontuações.csv` - Pontuações por tier/level/ID

## Estrutura da Base de Dados

### Tabelas Principais

- `users` - Utilizadores (suporta OAuth, password_hash é nullable)
- `players` - Jogadores (ligados a users via email)
- `tournaments` - Torneios (inclui `year` para determinar a época)
- `tournament_categories` - Categorias de torneio (tier, level, registration settings)
- `matches` - Jogos
- `points_table` - Tabela de pontuação:
  - `season` - Ano/época (2025, 2026, ...)
  - `tier` - OURO, PRATA, BRONZE
  - `level` - 1, 2 (ou 3 para 2026+)
  - `classification_id` - 1-6
  - `points` - Pontuação
- `player_rankings` - Rankings dos jogadores

### Migrações

Executar `backend/migrations/add_auth0_id.sql` para:
- Adicionar coluna `auth0_id` a users
- Tornar `password_hash` nullable (para OAuth)
- Adicionar coluna `email` a players
- Adicionar colunas de registo a tournament_categories

## Comandos Úteis

```bash
# Backend
cd backend && npm start

# Frontend
cd react-app && npm run dev
```

## Notas Importantes

- O nível (level) é derivado do nome da categoria (ex: "Masculino N1" → level 1)
- O tier é OURO, PRATA ou BRONZE
- PENULTIMO = penúltimo lugar no grupo
- ULTIMO = último lugar no grupo (sempre ID 6)
- Os pontos são baseados no ano do torneio (season = tournament.year)
- Para 2026: adicionar pontuações para Level 3 quando os valores forem definidos

## Para Adicionar Pontuações de Nova Época

1. Editar `backend/migrations/update_points_classification_id.sql`
2. Adicionar INSERT statements para a nova época:
```sql
INSERT INTO points_table (season, tier, level, classification_id, points)
VALUES (2026, 'OURO', 3, 1, XXX);
-- etc.
```
3. Executar a migração na base de dados
