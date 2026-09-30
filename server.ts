import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  initDatabase,
  getAllTournaments,
  getTournamentById,
  saveOrUpdateTournament,
  deleteTournamentById,
  updateTournamentQuickStatus,
  getAllMembers,
  saveOrUpdateMember,
  deleteMemberById,
  getTournamentGroups,
  saveTournamentGroups,
  assignMemberToPool,
  getTournamentBracket,
  saveTournamentBracket,
  getLiveRefereeState,
  saveLiveRefereeState,
  getSystemSyncSummary,
  resetDatabase,
  seedDefaultData
} from './src/server/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // JSON middleware with generous limit for images & bracket trees
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Initialize SQLite database
  await initDatabase();

  // ------------------- REST API ENDPOINTS ------------------- //

  // Health and System Sync Summary
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'LagiLagiPadel SQLite API', timestamp: new Date().toISOString() });
  });

  app.get('/api/sync/summary', async (req: Request, res: Response) => {
    try {
      const summary = await getSystemSyncSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Tournaments
  app.get('/api/tournaments', async (req: Request, res: Response) => {
    try {
      const tournaments = await getAllTournaments();
      res.json(tournaments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/tournaments/:id', async (req: Request, res: Response) => {
    try {
      const tourney = await getTournamentById(req.params.id);
      if (!tourney) return res.status(404).json({ error: 'Turnamen tidak ditemukan' });
      res.json(tourney);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/tournaments', async (req: Request, res: Response) => {
    try {
      const saved = await saveOrUpdateTournament(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/tournaments/:id', async (req: Request, res: Response) => {
    try {
      await deleteTournamentById(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/tournaments/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const updated = await updateTournamentQuickStatus(req.params.id, status);
      if (!updated) return res.status(404).json({ error: 'Turnamen tidak ditemukan' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Members
  app.get('/api/members', async (req: Request, res: Response) => {
    try {
      const members = await getAllMembers();
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/members', async (req: Request, res: Response) => {
    try {
      const saved = await saveOrUpdateMember(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/members/:id', async (req: Request, res: Response) => {
    try {
      await deleteMemberById(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Groups and Pool Allocation
  app.get('/api/groups/:tournamentId', async (req: Request, res: Response) => {
    try {
      const groups = await getTournamentGroups(req.params.tournamentId);
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/groups/:tournamentId', async (req: Request, res: Response) => {
    try {
      const pools = req.body.pools || req.body;
      const saved = await saveTournamentGroups(req.params.tournamentId, pools);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Dedicated endpoint: Assign member or pair into group/pool
  app.post('/api/groups/:tournamentId/assign-member', async (req: Request, res: Response) => {
    try {
      const { targetPool, member1Id, member2Id, customTeamName, seed } = req.body;
      if (!targetPool || !member1Id) {
        return res.status(400).json({ error: 'targetPool dan member1Id wajib diisi.' });
      }
      const updatedPools = await assignMemberToPool({
        tournamentId: req.params.tournamentId,
        targetPool,
        member1Id,
        member2Id,
        customTeamName,
        seed: seed ? Number(seed) : undefined
      });
      res.json({ success: true, pools: updatedPools });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Remove team from pool
  app.post('/api/groups/:tournamentId/remove-team', async (req: Request, res: Response) => {
    try {
      const { teamId } = req.body;
      const groups = await getTournamentGroups(req.params.tournamentId);
      const updated = groups.map((g) => ({
        ...g,
        teams: g.teams.filter((t) => t.id !== teamId)
      }));
      const saved = await saveTournamentGroups(req.params.tournamentId, updated);
      res.json({ success: true, pools: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Move team from one pool to another
  app.post('/api/groups/:tournamentId/move-team', async (req: Request, res: Response) => {
    try {
      const { teamId, targetPool } = req.body;
      const groups = await getTournamentGroups(req.params.tournamentId);
      let movingTeam: any = null;

      const cleaned = groups.map((g) => {
        const found = g.teams.find((t) => t.id === teamId);
        if (found) {
          movingTeam = { ...found, pool: targetPool };
          return { ...g, teams: g.teams.filter((t) => t.id !== teamId) };
        }
        return g;
      });

      if (movingTeam) {
        let dest = cleaned.find((g) => g.poolName.toLowerCase() === targetPool.toLowerCase());
        if (!dest) {
          dest = { poolName: targetPool, teams: [] };
          cleaned.push(dest);
        }
        dest.teams.push(movingTeam);
      }

      const saved = await saveTournamentGroups(req.params.tournamentId, cleaned);
      res.json({ success: true, pools: saved });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Brackets
  app.get('/api/brackets/:tournamentId', async (req: Request, res: Response) => {
    try {
      const bracket = await getTournamentBracket(req.params.tournamentId);
      res.json(bracket);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/brackets/:tournamentId', async (req: Request, res: Response) => {
    try {
      const bracket = req.body.bracket || req.body;
      const saved = await saveTournamentBracket(req.params.tournamentId, bracket);
      res.json(saved);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Referee Live Scoring State
  app.get('/api/referee/state', async (req: Request, res: Response) => {
    try {
      const state = await getLiveRefereeState();
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/referee/state', async (req: Request, res: Response) => {
    try {
      const state = await saveLiveRefereeState(req.body);
      res.json(state);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // System Reset & Seed
  app.post('/api/system/reset', async (req: Request, res: Response) => {
    try {
      const { cleanSlate } = req.body || {};
      await resetDatabase(Boolean(cleanSlate));
      res.json({ success: true, message: cleanSlate ? 'Database dikosongkan total' : 'Database direset ke data default' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/system/seed', async (req: Request, res: Response) => {
    try {
      await seedDefaultData();
      res.json({ success: true, message: 'Data default berhasil di-seed ke SQLite' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ------------------- FRONTEND / VITE INTEGRATION ------------------- //
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      // Fallback in case dist doesn't exist yet
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LagiLagiPadel Server] Running with SQLite database on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Failed to start server:', err);
  process.exit(1);
});
