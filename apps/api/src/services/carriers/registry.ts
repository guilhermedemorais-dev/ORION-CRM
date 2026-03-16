import type { ICarrierAdapter } from './ICarrierAdapter.js';
import { GenericRestAdapter } from './GenericRestAdapter.js';

const _generic = new GenericRestAdapter();

/**
 * Maps adapter_type → ICarrierAdapter instance.
 * When a dedicated adapter is built for a specific carrier (e.g. Jadlog),
 * add it here. Until then, all types fall back to GenericRestAdapter.
 */
const ADAPTERS: Record<string, ICarrierAdapter> = {
  generic_rest: _generic,
  jadlog:       _generic, // replace with JadlogAdapter() when implemented
  correios:     _generic, // replace with CorreiosAdapter() when implemented
  loggi:        _generic, // replace with LoggiAdapter() when implemented
  tnt:          _generic, // replace with TntAdapter() when implemented
  rapiddo:      _generic, // replace with RapiddoAdapter() when implemented
};

export function getCarrierAdapter(adapterType: string): ICarrierAdapter {
  return ADAPTERS[adapterType] ?? _generic;
}
