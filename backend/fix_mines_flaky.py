#!/usr/bin/env python3
"""Fix mines flaky test by mocking generateMinePositions for deterministic results"""

with open('src/modules/mines/mines.service.spec.ts', 'r') as f:
    content = f.read()

# Strategy: Instead of mocking generateMinePositions (which may not be public),
# make the test more resilient by retrying with a new game if the first tile is a mine

old_test = """    it('should reveal a safe tile and increase multiplier', async () => {
      const game = await service.startGame('user-reveal-1', { betAmount: 10, mineCount: 3 });
      
      // Find a safe tile (not a mine) - try all tiles until we find one
      let result;
      for (let i = 0; i < 25; i++) {
        try {
          result = await service.revealTile('user-reveal-1', { gameId: game.gameId, tileIndex: i });
          if (result.status !== 'LOST') break;
        } catch {
          break;
        }
      }
      if (result && result.status === 'ACTIVE') {
        expect(result.revealedTiles.length).toBe(1);
        expect(result.currentMultiplier).toBeGreaterThan(1);
        expect(result.currentPayout).toBeGreaterThan(0);
      }"""

new_test = """    it('should reveal a safe tile and increase multiplier', async () => {
      // Use mineCount=1 for highest chance of safe tile on first reveal (96%)
      // Retry up to 3 games to eliminate flakiness
      let found = false;
      for (let attempt = 0; attempt < 3 && !found; attempt++) {
        const userId = 'user-reveal-1-' + attempt;
        const game = await service.startGame(userId, { betAmount: 10, mineCount: 1 });
        
        // Try tile 0 - with 1 mine in 25 tiles, 96% chance it's safe
        const result = await service.revealTile(userId, { gameId: game.gameId, tileIndex: 0 });
        if (result.status === 'ACTIVE') {
          expect(result.revealedTiles.length).toBe(1);
          expect(result.currentMultiplier).toBeGreaterThan(1);
          expect(result.currentPayout).toBeGreaterThan(0);
          found = true;
        }
      }
      expect(found).toBe(true);"""

content = content.replace(old_test, new_test)

with open('src/modules/mines/mines.service.spec.ts', 'w') as f:
    f.write(content)

print('DONE - mines flaky test fixed')
