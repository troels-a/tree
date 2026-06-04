"use client";

import styles from "./ClearButton.module.css";

interface ClearButtonProps {
  onClear: () => void;
}

export default function ClearButton({ onClear }: ClearButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onClear}>
      clear
    </button>
  );
}
