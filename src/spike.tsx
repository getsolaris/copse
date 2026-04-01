import { render } from "@opentui/solid";

declare module "solid-js" {
  namespace JSX {
    interface IntrinsicElements {
      box: any;
      text: any;
    }
  }
}

function App() {
  return (
    <box width={40} height={10} border={{ type: "line" }}>
      <text x={2} y={2}>Hello from omw!</text>
      <text x={2} y={4}>OpenTUI + SolidJS is working!</text>
    </box>
  );
}

render(() => <App />, { exitOnCtrlC: true });
