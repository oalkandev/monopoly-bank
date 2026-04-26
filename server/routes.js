import express from 'express';
import path from 'node:path';
import * as state from './state.js';

export function mountRoutes(app) {
  const publicDir = process.env.MONOPOLY_PUBLIC_DIR
    ? path.resolve(process.env.MONOPOLY_PUBLIC_DIR)
    : path.resolve('public');

  app.use(express.json());
  app.use(express.static(publicDir));

  app.get('/', (_req, res) => res.redirect('/player'));
  app.get('/player', (_req, res) => res.sendFile(path.join(publicDir, 'player.html')));
  app.get('/banker', (_req, res) => res.sendFile(path.join(publicDir, 'banker.html')));

  app.get('/join/:token', (req, res) => {
    const player = state.findByToken(req.params.token);
    if (!player) return res.status(404).sendFile(path.join(publicDir, 'join.html'));
    res.cookie('playerToken', req.params.token, { httpOnly: false, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/player');
  });

  app.get('/api/state', (_req, res) => res.json(state.get()));
}
