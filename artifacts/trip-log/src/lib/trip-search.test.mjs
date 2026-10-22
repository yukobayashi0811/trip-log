import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortTrips,
  tripRegionOptions,
  tripYearOptions,
} from './trip-search.ts';

const trips = [
  { id: 'a', title: 'Autumn in Japan', startDate: '2024-10-01', destinationRegion: 'Japan' },
  { id: 'c', title: 'Japan, again', startDate: '2024-10-01', destinationRegion: ' japan ' },
  { id: 'b', title: 'New year in Iceland', startDate: '2025-01-01', destinationRegion: 'Iceland' },
  { id: 'd', title: 'A long winter trip', startDate: '2024-12-31', destinationRegion: null },
];
const defaults = {
  query: '',
  region: '',
  year: '',
  starredOnly: false,
  sortOrder: 'newest',
};
const ids = (rows) => rows.map(({ id }) => id);

describe('All Trips search, filters, and date-only sorting', () => {
  it('trims queries and matches title substrings without case sensitivity', () => {
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), { ...defaults, query: '  jApAn  ' })), ['a', 'c']);
  });

  it('treats a blank query as empty and returns no trips for a non-match', () => {
    assert.equal(filterAndSortTrips(trips, new Set(), { ...defaults, query: '   ' }).length, trips.length);
    assert.deepEqual(filterAndSortTrips(trips, new Set(), { ...defaults, query: 'moon' }), []);
  });

  it('derives sorted unique region options while ignoring missing and blank values', () => {
    assert.deepEqual(tripRegionOptions([
      ...trips,
      { id: 'e', title: 'Blank', startDate: '2023-01-01', destinationRegion: '  ' },
      { id: 'f', title: 'Repeated', startDate: '2023-01-02', destinationRegion: 'JAPAN' },
    ]), ['Iceland', 'Japan']);
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), { ...defaults, region: ' japan ' })), ['a', 'c']);
  });

  it('uses the date-only start year, including trips starting at year boundaries', () => {
    assert.deepEqual(tripYearOptions(trips), ['2025', '2024']);
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), { ...defaults, year: '2024' })), ['d', 'a', 'c']);
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), { ...defaults, year: '2025' })), ['b']);
  });

  it('filters starred trips and reacts when the starred ID set changes', () => {
    const starred = new Set(['a']);
    assert.deepEqual(ids(filterAndSortTrips(trips, starred, { ...defaults, starredOnly: true })), ['a']);
    starred.add('b');
    assert.deepEqual(ids(filterAndSortTrips(trips, starred, { ...defaults, starredOnly: true })), ['b', 'a']);
    starred.delete('a');
    assert.deepEqual(ids(filterAndSortTrips(trips, starred, { ...defaults, starredOnly: true })), ['b']);
  });

  it('sorts newest/oldest by date and breaks equal-date ties by trip ID', () => {
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), defaults)), ['b', 'd', 'a', 'c']);
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), { ...defaults, sortOrder: 'oldest' })), ['a', 'c', 'd', 'b']);
  });

  it('combines all filters and restores the full newest-first list after reset', () => {
    const combined = filterAndSortTrips(
      trips,
      new Set(['a', 'c']),
      { query: 'japan', region: 'JAPAN', year: '2024', starredOnly: true, sortOrder: 'oldest' },
    );
    assert.deepEqual(ids(combined), ['a', 'c']);
    assert.deepEqual(ids(filterAndSortTrips(trips, new Set(), defaults)), ['b', 'd', 'a', 'c']);
  });
});
