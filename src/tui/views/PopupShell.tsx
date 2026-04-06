import { Show, type JSX, type ParentProps } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";
import { theme } from "../themes.ts";

interface PopupShellProps {
  width: number;
  height: number;
  title: string;
  borderColor?: string;
  backgroundColor?: string;
  backdrop?: boolean;
  backdropColor?: string;
  gap?: number;
  footer?: JSX.Element;
}

export function PopupShell(props: ParentProps<PopupShellProps>) {
  const dims = useTerminalDimensions();
  const dialogX = () => Math.max(0, Math.floor((dims().width - props.width) / 2));
  const dialogY = () => Math.max(0, Math.floor((dims().height - props.height) / 2));

  const shell = () => (
    <box
      x={dialogX()}
      y={dialogY()}
      width={props.width}
      height={props.height}
      border={true}
      borderStyle="rounded"
      borderColor={props.borderColor ?? theme.border.active}
      backgroundColor={props.backgroundColor ?? theme.bg.surface}
      flexDirection="column"
      paddingX={1}
      paddingY={1}
      gap={props.gap ?? 0}
      title={props.title}
      titleAlignment="left"
      position="absolute"
    >
      {props.children}
      <Show when={props.footer}>{props.footer}</Show>
    </box>
  );

  return (
    <Show
      when={props.backdrop}
      fallback={shell()}
    >
      <box
        x={0}
        y={0}
        width={dims().width}
        height={dims().height}
        backgroundColor={props.backdropColor ?? theme.bg.overlay}
        position="absolute"
      >
        {shell()}
      </box>
    </Show>
  );
}
