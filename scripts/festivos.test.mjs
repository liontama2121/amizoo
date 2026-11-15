// Pruebas de festivos de Colombia 2026 y 2027. Uso: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { festivos, pascua, desdeLocal, fechaLocal, horaLocal } from '../functions/_lib/agenda.js';

const lista = (y) => [...festivos(y)].sort();

test('Pascua', () => {
  assert.equal(pascua(2026), '2026-04-05');
  assert.equal(pascua(2027), '2027-03-28');
});

test('Festivos 2026', () => {
  assert.deepEqual(lista(2026), [
    '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18',
    '2026-06-08', '2026-06-15', '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12',
    '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25',
  ]);
});

test('Festivos 2027', () => {
  assert.deepEqual(lista(2027), [
    '2027-01-01', '2027-01-11', '2027-03-22', '2027-03-25', '2027-03-26', '2027-05-01', '2027-05-10',
    '2027-05-31', '2027-06-07', '2027-07-05', '2027-07-20', '2027-08-07', '2027-08-16', '2027-10-18',
    '2027-11-01', '2027-11-15', '2027-12-08', '2027-12-25',
  ]);
});

test('Hora de Bogotá (UTC-5)', () => {
  const ms = desdeLocal('2026-11-20', '08:30');
  assert.equal(new Date(ms).toISOString(), '2026-11-20T13:30:00.000Z');
  assert.equal(fechaLocal(ms), '2026-11-20');
  assert.equal(horaLocal(ms), '08:30');
});
