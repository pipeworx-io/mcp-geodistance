interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Geographic coordinate math MCP.
 *
 * Keyless, offline geodesy: great-circle (haversine) distance between two
 * lat/lon points, initial bearing, a destination point given bearing+distance,
 * and DMS<->decimal conversion. Pure math — no API, no key. (For geocoding an
 * address to coordinates, use a geocoding pack; this operates on coordinates.)
 */


const R_KM = 6371.0088; // mean Earth radius
const UNIT: Record<string, number> = { km: 1, m: 1000, mi: 0.621371192, nmi: 0.539956803, ft: 3280.83989 };
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function haversine(la1: number, lo1: number, la2: number, lo2: number): number {
  const dLa = toRad(la2 - la1), dLo = toRad(lo2 - lo1);
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLo / 2) ** 2;
  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(la1: number, lo1: number, la2: number, lo2: number): number {
  const y = Math.sin(toRad(lo2 - lo1)) * Math.cos(toRad(la2));
  const x = Math.cos(toRad(la1)) * Math.sin(toRad(la2)) - Math.sin(toRad(la1)) * Math.cos(toRad(la2)) * Math.cos(toRad(lo2 - lo1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function compass(b: number): string {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(b / 22.5) % 16];
}

function toDMS(v: number, isLat: boolean): string {
  const hemi = isLat ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
  const abs = Math.abs(v);
  const d = Math.floor(abs), m = Math.floor((abs - d) * 60), s = ((abs - d) * 60 - m) * 60;
  return `${d}°${m}′${s.toFixed(2)}″${hemi}`;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'distance',
    description: 'Great-circle (haversine) distance between two lat/lon points. Returns the distance in km, miles, nautical miles, meters & feet, plus the initial compass bearing from point 1 to point 2.',
    inputSchema: {
      type: 'object',
      properties: {
        lat1: { type: 'number', description: 'Latitude of point 1 (decimal degrees).' },
        lon1: { type: 'number', description: 'Longitude of point 1.' },
        lat2: { type: 'number', description: 'Latitude of point 2.' },
        lon2: { type: 'number', description: 'Longitude of point 2.' },
      },
      required: ['lat1', 'lon1', 'lat2', 'lon2'],
    },
  },
  {
    name: 'destination',
    description: 'Given a start lat/lon, a bearing (degrees) and a distance, compute the destination point. `unit` = km (default), mi, nmi, m or ft.',
    inputSchema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Start latitude (decimal degrees).' },
        lon: { type: 'number', description: 'Start longitude.' },
        bearing: { type: 'number', description: 'Initial bearing in degrees (0=N, 90=E).' },
        distance: { type: 'number', description: 'Distance to travel.' },
        unit: { type: 'string', description: 'Distance unit: km (default), mi, nmi, m, ft.' },
      },
      required: ['lat', 'lon', 'bearing', 'distance'],
    },
  },
  {
    name: 'dms_to_decimal',
    description: 'Parse a degrees-minutes-seconds coordinate string to decimal degrees. Accepts forms like "40°26′46″N" or "40 26 46 N" or "-73.5". Returns the decimal value.',
    inputSchema: { type: 'object', properties: { dms: { type: 'string', description: 'A DMS coordinate string, e.g. "40°26′46″N".' } }, required: ['dms'] },
  },
  {
    name: 'decimal_to_dms',
    description: 'Convert decimal lat/lon to degrees-minutes-seconds strings.',
    inputSchema: { type: 'object', properties: { lat: { type: 'number', description: 'Latitude (decimal degrees).' }, lon: { type: 'number', description: 'Longitude (decimal degrees).' } }, required: ['lat', 'lon'] },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'distance': {
      const [la1, lo1, la2, lo2] = ['lat1', 'lon1', 'lat2', 'lon2'].map((k) => num(args, k));
      const km = haversine(la1, lo1, la2, lo2);
      const b = bearing(la1, lo1, la2, lo2);
      return { km: +km.toFixed(3), miles: +(km * UNIT.mi).toFixed(3), nautical_miles: +(km * UNIT.nmi).toFixed(3), meters: +(km * 1000).toFixed(1), feet: +(km * UNIT.ft).toFixed(1), initial_bearing_deg: +b.toFixed(1), compass: compass(b) };
    }
    case 'destination': {
      const la = num(args, 'lat'), lo = num(args, 'lon'), brg = num(args, 'bearing'), dist = num(args, 'distance');
      const unit = typeof args.unit === 'string' && UNIT[args.unit] ? args.unit : 'km';
      const dKm = dist / UNIT[unit];
      const dr = dKm / R_KM, br = toRad(brg), la1 = toRad(la), lo1 = toRad(lo);
      const la2 = Math.asin(Math.sin(la1) * Math.cos(dr) + Math.cos(la1) * Math.sin(dr) * Math.cos(br));
      const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(dr) * Math.cos(la1), Math.cos(dr) - Math.sin(la1) * Math.sin(la2));
      return { lat: +toDeg(la2).toFixed(6), lon: +(((toDeg(lo2) + 540) % 360) - 180).toFixed(6), input_unit: unit };
    }
    case 'dms_to_decimal': {
      const dms = reqStr(args, 'dms', '"40°26′46″N"');
      const m = dms.match(/(-?\d+(?:\.\d+)?)[°\s]+(?:(\d+(?:\.\d+)?)[′'\s]+)?(?:(\d+(?:\.\d+)?)[″"\s]*)?\s*([NSEW])?/i);
      if (!m || (m[2] === undefined && m[4] === undefined && !/^-?\d+(\.\d+)?$/.test(dms.trim()))) {
        const plain = Number(dms.trim());
        if (Number.isFinite(plain)) return { input: dms, decimal: plain };
        return { input: dms, error: 'Could not parse a DMS or decimal coordinate.' };
      }
      let dec = Math.abs(+m[1]) + (m[2] ? +m[2] / 60 : 0) + (m[3] ? +m[3] / 3600 : 0);
      const hemi = (m[4] || '').toUpperCase();
      if (hemi === 'S' || hemi === 'W' || +m[1] < 0) dec = -dec;
      return { input: dms, decimal: +dec.toFixed(8) };
    }
    case 'decimal_to_dms': {
      const la = num(args, 'lat'), lo = num(args, 'lon');
      return { lat_dms: toDMS(la, true), lon_dms: toDMS(lo, false), lat: la, lon: lo };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function num(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new Error(`Required numeric argument "${key}" is missing or invalid.`);
  return n;
}
function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
