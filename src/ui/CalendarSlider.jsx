import React, { useState, useEffect } from "react";
import styles from "./CalendarSlider.module.css";

export default function CalendarSlider({ windowDays = 7, onChange }) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [startDate, setStartDate] = useState(startOfToday);
  const [anim, setAnim] = useState(null);

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function formatShort(d) {
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  }

  // ✅ FIX: send OBJECT not params
  useEffect(() => {
    if (typeof onChange === "function") {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = addDays(startDate, windowDays - 1);
      end.setHours(23, 59, 59, 999);

      onChange({
        start,
        end,
      });
    }
  }, [startDate, windowDays, onChange]);

  const rangeLabel = () => {
    const end = addDays(startDate, windowDays - 1);
    return `${formatShort(startDate)} - ${formatShort(end)}`;
  };

  const handlePrev = () => {
    setAnim("right");

    setTimeout(() => {
      setStartDate((s) => addDays(s, -windowDays));
      setAnim(null);
    }, 200);
  };

  const handleNext = () => {
    setAnim("left");

    setTimeout(() => {
      setStartDate((s) => addDays(s, windowDays));
      setAnim(null);
    }, 200);
  };

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.pill} ${anim === "left" ? styles.slideLeft : ""} ${anim === "right" ? styles.slideRight : ""}`} role="group" aria-label="Date range navigator">
        <button className={styles.innerButton} aria-label="Previous range" onClick={handlePrev}>
          {"<"}
        </button>

        <div className={styles.label} aria-live="polite">
          {rangeLabel()}
        </div>

        <button className={styles.innerButton} aria-label="Next range" onClick={handleNext}>
          {">"}
        </button>
      </div>
    </div>
  );
}
