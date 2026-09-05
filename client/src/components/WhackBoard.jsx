const HOLE_COUNT = 9;

function holeClassName(index, activeHole, bonkedHole, missHole) {
  const classes = ['whack-spot'];
  if (activeHole === index) {
    classes.push('is-active');
  }
  if (bonkedHole === index) {
    classes.push('is-bonked');
  }
  if (missHole === index) {
    classes.push('is-miss');
  }
  return classes.join(' ');
}

export default function WhackBoard({
  activeHole,
  bonkedHole,
  missHole,
  popText,
  onWhack,
  disabled,
}) {
  const holes = Array.from({ length: HOLE_COUNT }, (_, index) => index);

  function handlePointerDown(event, index) {
    if (disabled) {
      return;
    }
    event.preventDefault();
    onWhack(index);
  }

  return (
    <div className="whack-board" role="application" aria-label="Whack-a-Mole board">
      {holes.map((index) => (
        <button
          key={index}
          type="button"
          className={holeClassName(index, activeHole, bonkedHole, missHole)}
          aria-label={`Hole ${index + 1}`}
          disabled={disabled}
          onPointerDown={(event) => handlePointerDown(event, index)}
        >
          <span className="whack-mound" aria-hidden="true" />
          <span className="whack-hole" aria-hidden="true">
            <span className="whack-mole">
              <span className="whack-mole-body" />
              <span className="whack-mole-belly" />
              <span className="whack-mole-eye left" />
              <span className="whack-mole-eye right" />
              <span className="whack-mole-nose" />
              <span className="whack-mole-tooth" />
            </span>
            {bonkedHole === index && popText ? <span className="whack-pop">{popText}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}
