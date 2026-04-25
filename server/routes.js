import express from 'express';
import path from 'node:path';
import * as state from './state.js';

export function mountRoutes(app) {
  app.use(express.json());
  app.use(express.static(path.resolve('public')));

  app.get('/', (_req, res) => res.redirect('/player'));
  app.get('/player', (_req, res) => res.sendFile(path.resolve('public/player.html')));
  app.get('/banker', (_req, res) => res.sendFile(path.resolve('public/banker.html')));

  app.get('/join/:token', (req, res) => {
    const player = state.findByToken(req.params.token);
    if (!player) return res.status(404).sendFile(path.resolve('public/join.html'));
    res.cookie('playerToken', req.params.token, { httpOnly: false, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.redirect('/player');
  });

  app.get('/api/state', (_req, res) => res.json(state.get()));
}
