

export const methods = {
  spikeHit(owner, victim, nx, nz) {
    const ready = victim.bumpCooldown.get(owner) ?? 0;
    if (this.time < ready) return;
    victim.bumpCooldown.set(owner, this.time + 0.8);
    this.damage(victim, 14, owner, 'spikes', { knockX: nx * 12, knockZ: nz * 12, spin: 0.6 });
  },
};
