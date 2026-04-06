import { createSignal, onCleanup } from "solid-js";
import { theme } from "../themes.ts";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface SpinnerProps {
  label?: string;
  color?: string;
}

export function Spinner(props: SpinnerProps) {
  const [frame, setFrame] = createSignal(0);
  const id = setInterval(() => {
    setFrame((f) => (f + 1) % FRAMES.length);
  }, 80);
  onCleanup(() => clearInterval(id));

  return (
    <box flexDirection="row" gap={1}>
      <text fg={props.color ?? theme.text.accent}>{FRAMES[frame()]}</text>
      {props.label && <text fg={theme.text.secondary}>{props.label}</text>}
    </box>
  );
}
