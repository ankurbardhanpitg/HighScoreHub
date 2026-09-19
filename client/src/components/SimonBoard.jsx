import { PADS } from '../game/simon.js';

function padClassName(pad, litPad, missPad, disabled) {
  const classes = ['simon-pad', `simon-pad-${pad.name}`];
  if (litPad === pad.id) {
    classes.push('is-lit');
  }
  if (missPad === pad.id) {
    classes.push('is-miss');
  }
  if (disabled) {
    classes.push('is-locked');
  }
  return classes.join(' ');
}

export default function SimonBoard({ litPad, missPad, round, statusText, onPlay, disabled }) {
  return (
    <div className="simon-board" role="application" aria-label="Simon Says board">
      {PADS.map((pad) => (
        <button
          key={pad.id}
          type="button"
          className={padClassName(pad, litPad, missPad, disabled)}
          aria-label={pad.label}
          disabled={disabled}
          onPointerDown={(event) => {
            if (disabled) {
              return;
            }
            event.preventDefault();
            onPlay(pad.id);
          }}
        />
      ))}
      <div className="simon-hub" aria-hidden="true">
        <strong>{round || 'Go'}</strong>
        <span>{statusText}</span>
      </div>
    </div>
  );
}
