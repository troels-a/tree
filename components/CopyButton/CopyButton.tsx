"use client";

import styles from "./CopyButton.module.css";

interface CopyButtonProps {
  copied: boolean;
  onCopy: () => void;
}

export default function CopyButton({ copied, onCopy }: CopyButtonProps) {
  return (
    <button type="button" className={styles.button} onClick={onCopy}>
      {copied ? "copied!" : "copy"}
    </button>
  );
}
