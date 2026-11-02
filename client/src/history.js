export function matchFilter(tx, filter) {
  if (filter === 'all') return true;
  if (filter === 'bank') return !tx.from || !tx.to;
  if (filter.startsWith('player:')) {
    const id = filter.slice(7);
    return tx.from === id || tx.to === id;
  }
  return true;
}
