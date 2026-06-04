declare module "circular-natal-horoscope-js" {
  export interface OriginInput {
    year: number;
    month: number;
    date: number;
    hour: number;
    minute: number;
    latitude: number;
    longitude: number;
  }
  export class Origin {
    constructor(input: OriginInput);
  }

  interface SignLabel {
    label: string;
  }
  interface EclipticPosition {
    DecimalDegrees: number;
  }
  interface ChartPosition {
    Ecliptic: EclipticPosition;
  }
  interface CelestialBody {
    key: string;
    label: string;
    Sign: SignLabel;
    ChartPosition: ChartPosition;
  }
  interface AnglePoint {
    Sign: SignLabel;
    ChartPosition: ChartPosition;
  }

  export interface HoroscopeInput {
    origin: Origin;
    houseSystem?: string;
    zodiac?: string;
    aspectPoints?: string[];
    aspectWithPoints?: string[];
    aspectTypes?: string[];
    language?: string;
  }
  export class Horoscope {
    constructor(input: HoroscopeInput);
    SunSign: SignLabel;
    Ascendant: AnglePoint;
    Midheaven: AnglePoint;
    CelestialBodies: {
      sun: CelestialBody;
      moon: CelestialBody;
      all: CelestialBody[];
    };
  }
}
