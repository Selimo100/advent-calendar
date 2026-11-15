/**
 * Input for the mission: pointer events for the on-screen controls and
 * keyboard for desktop. Both feed the same small state object that the game
 * loop reads once per frame.
 *
 * Touch rules that matter in practice:
 *   - every pointer is tracked by its own id, so moving and jumping at the
 *     same time works with two fingers;
 *   - the control captures its pointer, so a finger that slides off the
 *     button still releases that button;
 *   - pointerup, pointercancel, lostpointercapture, window blur and the page
 *     becoming hidden all release, so no direction can stay stuck.
 */

export type Control = 'left' | 'right' | 'jump';

export interface InputSnapshot {
  left: boolean;
  right: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface InputController {
  /** Reads and clears the one-shot jump press. */
  consume(): InputSnapshot;
  /** Current held state without consuming the jump press. */
  peek(): InputSnapshot;
  press(control: Control, pointerId?: number): void;
  release(control: Control, pointerId?: number): void;
  releaseByPointer(pointerId: number): void;
  /** Clears everything (pause, blur, respawn). */
  releaseAll(): void;
  /** Escape was pressed; the shell polls this to toggle its pause menu. */
  consumePauseRequest(): boolean;
  destroy(): void;
}

const MOVE_KEYS: Record<string, Control> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
};

export function createInput(options: { enabled: () => boolean } = { enabled: () => true }): InputController {
  /** Which pointer ids currently hold which control. */
  const pointers = new Map<number, Control>();
  const keys = new Set<Control>();
  let jumpPressed = false;
  let pauseRequested = false;

  const held = (control: Control): boolean => {
    if (keys.has(control)) return true;
    for (const value of pointers.values()) if (value === control) return true;
    return false;
  };

  const snapshot = (consumeJump: boolean): InputSnapshot => {
    const result: InputSnapshot = {
      left: held('left'),
      right: held('right'),
      jumpPressed,
      jumpHeld: held('jump'),
    };
    if (consumeJump) jumpPressed = false;
    return result;
  };

  const press = (control: Control, pointerId?: number) => {
    if (pointerId !== undefined) {
      if (pointers.get(pointerId) === control) return;
      pointers.set(pointerId, control);
    } else {
      if (keys.has(control)) return;
      keys.add(control);
    }
    if (control === 'jump') jumpPressed = true;
  };

  const release = (control: Control, pointerId?: number) => {
    if (pointerId !== undefined) pointers.delete(pointerId);
    else keys.delete(control);
  };

  const releaseAll = () => {
    pointers.clear();
    keys.clear();
    jumpPressed = false;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!options.enabled()) return;
    if (event.code === 'Escape') {
      pauseRequested = true;
      return;
    }
    const control = MOVE_KEYS[event.code];
    if (!control) return;
    // Only while the game is active: arrow keys and space must keep scrolling
    // the rest of the site normally.
    event.preventDefault();
    if (event.repeat) return;
    press(control);
  };

  const onKeyUp = (event: KeyboardEvent) => {
    const control = MOVE_KEYS[event.code];
    if (!control) return;
    event.preventDefault();
    release(control);
  };

  const onBlur = () => releaseAll();
  const onVisibility = () => {
    if (document.hidden) releaseAll();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    consume: () => snapshot(true),
    peek: () => snapshot(false),
    press,
    release,
    releaseByPointer: (pointerId) => pointers.delete(pointerId),
    releaseAll,
    consumePauseRequest: () => {
      const value = pauseRequested;
      pauseRequested = false;
      return value;
    },
    destroy: () => {
      releaseAll();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
