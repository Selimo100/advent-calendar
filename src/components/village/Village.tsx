import type { DoorSummary } from '../../lib/useCalendar.ts';
import { TreeGroveArt } from './HouseArt.tsx';
import { House } from './House.tsx';
import { GRAND_DOOR, VILLAGE_ORDER } from './houses.ts';

export interface VillageProps {
  year: number;
  doors: DoorSummary[];
  todayDoor: number | null;
  celebrateDay: number | null;
  registerDoor: (day: number, el: HTMLButtonElement | null) => void;
  onActivate: (day: number) => void;
}

export function Village({ year, doors, todayDoor, celebrateDay, registerDoor, onActivate }: VillageProps) {
  const byDay = new Map(doors.map((d) => [d.day, d]));
  const render = (day: number) => {
    const door = byDay.get(day) ?? { day, state: 'locked' as const };
    return (
      <House
        ref={(el) => registerDoor(day, el)}
        day={day}
        year={year}
        state={door.state}
        title={door.title}
        isToday={todayDoor === day}
        celebrate={celebrateDay === day}
        onActivate={onActivate}
      />
    );
  };

  return (
    <ul className="village" aria-label="Das Adventsdorf mit 24 Türchen">
      {VILLAGE_ORDER.map((day) => (
        <li key={day}>{render(day)}</li>
      ))}
      <li aria-hidden="true" className="pointer-events-none">
        <TreeGroveArt />
      </li>
      <li className="village-grand" style={{ marginTop: '1.25rem' }}>
        {render(GRAND_DOOR)}
      </li>
    </ul>
  );
}
