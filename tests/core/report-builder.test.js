import { describe, it, expect } from 'vitest';
import { loadCore } from '../helpers/browser-test-utils.js';

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; }
    };
}

function setup(storage = memoryStorage()) {
    const { window } = loadCore(['js/report-builder.js']);
    const api = window.FormulaFoundryReport;
    return { api, storage, store: api.createProjectStore(storage) };
}

const snap = (id, extra = {}) => ({
    calculatorId: id,
    calculatorName: 'Calc ' + id,
    path: `calculators/${id}.html`,
    title: 'Title ' + id,
    inputs: [{ label: 'Force', value: 100, unit: 'N' }],
    outputs: [{ label: 'Stress', value: 12.5, unit: 'MPa' }],
    equations: ['x = y'],
    assumptions: ['linear'],
    method: 'method',
    warnings: ['careful'],
    ...extra
});

describe('project report snapshots', () => {
    it('accepts a valid snapshot and preserves values', () => {
        const { api } = setup();
        const result = api.validateSnapshot(snap('moment'));
        expect(result.ok).toBe(true);
        expect(result.snapshot.inputs[0]).toEqual({ label: 'Force', value: 100, unit: 'N' });
        expect(result.snapshot.equations).toEqual(['x = y']);
    });

    it.each([
        ['null', null],
        ['missing id', { ...snap('x'), calculatorId: '' }],
        ['bad id', { ...snap('x'), calculatorId: 'Bad Id!' }],
        ['no inputs', { ...snap('x'), inputs: [] }],
        ['no outputs', { ...snap('x'), outputs: [] }],
        ['non-finite output', { ...snap('x'), outputs: [{ label: 'a', value: NaN, unit: '' }] }],
        ['infinite output', { ...snap('x'), outputs: [{ label: 'a', value: Infinity, unit: '' }] }],
        ['NaN text output', { ...snap('x'), outputs: [{ label: 'a', value: 'NaN mm', unit: '' }] }],
        ['missing input value', { ...snap('x'), inputs: [{ label: 'a', value: '', unit: '' }] }],
        ['undefined input value', { ...snap('x'), inputs: [{ label: 'a', unit: '' }] }]
    ])('rejects %s', (name, value) => {
        const { api } = setup();
        const result = api.validateSnapshot(value);
        expect(result.ok).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('stores a copy: later mutation of the source object does not change the saved entry', () => {
        const { store } = setup();
        const source = snap('moment');
        store.addEntry(source);
        source.outputs[0].value = 999;
        source.inputs[0].value = 1;
        const saved = store.load().entries[0];
        expect(saved.outputs[0].value).toBe(12.5);
        expect(saved.inputs[0].value).toBe(100);
    });
});

describe('project report store', () => {
    it('adds several different calculations, edits, reorders and removes them', () => {
        const { store } = setup();
        const ids = ['moment', 'press-fit', 'hertzian-contact'].map((id) => store.addEntry(snap(id)).entry.id);
        expect(store.count()).toBe(3);

        store.updateEntry(ids[0], { title: 'Renamed', notes: 'My note' });
        expect(store.load().entries[0]).toMatchObject({ title: 'Renamed', notes: 'My note' });
        store.updateEntry(ids[0], { title: '   ' });
        expect(store.load().entries[0].title).toBe('Calc moment');

        expect(store.moveEntry(ids[2], -1)).toBe(true);
        expect(store.load().entries.map((e) => e.calculatorId)).toEqual(['moment', 'hertzian-contact', 'press-fit']);
        expect(store.moveEntry(ids[0], -1)).toBe(false);
        expect(store.moveEntry(ids[1], 1)).toBe(false);

        expect(store.removeEntry(ids[2])).toBe(true);
        expect(store.removeEntry('missing')).toBe(false);
        expect(store.load().entries.map((e) => e.calculatorId)).toEqual(['moment', 'press-fit']);
    });

    it('stores project metadata and clears everything', () => {
        const { store, storage, api } = setup();
        store.updateMeta({ title: 'Bracket', revision: 'B', unknown: 'x' });
        store.addEntry(snap('moment'));
        const project = store.load();
        expect(project.meta.title).toBe('Bracket');
        expect(project.meta.revision).toBe('B');
        expect('unknown' in project.meta).toBe(false);
        expect(JSON.parse(storage.data[api.STORAGE_KEY]).schemaVersion).toBe(1);
        store.clear();
        expect(store.load().entries).toEqual([]);
        expect(store.load().meta.title).toBe('');
    });

    it('persists across store instances (page navigation / refresh)', () => {
        const { store, storage, api } = setup();
        store.addEntry(snap('moment'));
        const reopened = api.createProjectStore(storage);
        expect(reopened.count()).toBe(1);
    });

    it('survives malformed, outdated or partially invalid stored data', () => {
        const key = 'formulaFoundry.projectReport';
        const { api } = setup();
        const bad = (raw) => api.createProjectStore(memoryStorage({ [key]: raw })).load();
        expect(bad('not json{').entries).toEqual([]);
        expect(bad('null').entries).toEqual([]);
        expect(bad(JSON.stringify({ schemaVersion: 0, entries: [snap('moment')] })).entries).toEqual([]);
        expect(bad(JSON.stringify({ schemaVersion: 99 })).entries).toEqual([]);

        const mixed = bad(JSON.stringify({
            schemaVersion: 1,
            meta: { title: 'Kept', customer: 42 },
            entries: [snap('moment', { id: 'a1' }), { junk: true }, snap('press-fit', { id: 'a2', outputs: [{ label: 'x', value: 'NaN', unit: '' }] }), snap('fillet-weld', { id: 'a3' }), snap('fillet-weld', { id: 'a3' })]
        }));
        expect(mixed.meta.title).toBe('Kept');
        expect(mixed.meta.customer).toBe('42');
        expect(mixed.entries.map((e) => e.id)).toEqual(['a1', 'a3']);
    });

    it('works without storage (in-memory) and survives a throwing storage', () => {
        const { api } = setup();
        const none = api.createProjectStore(null);
        none.addEntry(snap('moment'));
        expect(none.count()).toBe(1);
        const broken = api.createProjectStore({
            getItem() { throw new Error('denied'); },
            setItem() { throw new Error('quota'); },
            removeItem() { throw new Error('denied'); }
        });
        expect(broken.addEntry(snap('moment')).ok).toBe(true);
        expect(broken.load().entries).toHaveLength(1);
        broken.clear();
        expect(broken.load().entries).toHaveLength(0);
    });

    it('rejects an invalid entry without touching existing ones', () => {
        const { store } = setup();
        store.addEntry(snap('moment'));
        const result = store.addEntry({ ...snap('x'), outputs: [{ label: 'a', value: Infinity, unit: '' }] });
        expect(result.ok).toBe(false);
        expect(store.count()).toBe(1);
    });

    it('formats values without false precision', () => {
        const { api } = setup();
        expect(api.formatValue(2463.76684843)).toBe('2463.77');
        expect(api.formatValue(0)).toBe('0');
        expect(api.formatValue('text')).toBe('text');
    });
});
