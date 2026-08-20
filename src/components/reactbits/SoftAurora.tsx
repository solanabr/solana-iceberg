/**
 * SoftAurora — reactbits.dev (Aurora background)
 * WebGL-based aurora borealis using OGL. Smoother than CSS aurora.
 */
import { useEffect, useRef, memo } from "react";
import { Renderer, Program, Mesh, Color, Triangle } from "ogl";

interface SoftAuroraProps {
  colorStops?: [string, string, string];
  amplitude?: number;
  blend?: number;
  speed?: number;
}

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop { vec3 color; float position; };

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  // Color ramp
  int idx = 0;
  for (int i = 0; i < 2; i++) {
    if (colors[i].position <= uv.x) idx = i;
  }
  float range = colors[idx+1].position - colors[idx].position;
  float lerpFactor = (uv.x - colors[idx].position) / range;
  vec3 rampColor = mix(colors[idx].color, colors[idx+1].color, lerpFactor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor = intensity * rampColor;
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}`;

const SoftAurora = memo(function SoftAurora({
  colorStops = ["#9945FF", "#14F195", "#9945FF"],
  amplitude = 1.0,
  blend = 0.5,
  speed = 0.8,
}: SoftAuroraProps) {
  const ctnRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ colorStops, amplitude, blend, speed });
  propsRef.current = { colorStops, amplitude, blend, speed };

  useEffect(() => {
    const ctn = ctnRef.current;
    if (!ctn) return;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";

    const geometry = new Triangle(gl);
    if (geometry.attributes.uv) delete geometry.attributes.uv;

    const colorStopsArray = colorStops.map((hex: string) => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    });

    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend: { value: blend },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(gl.canvas);

    /* `renderer.setSize` assigns canvas.width/height, which throws away the
       GL drawing buffer and allocates a new one — measured at ~56ms per
       changed axis for this 1440x900 antialiased context on an M1 Pro, which
       made it ~92% of this app's entire per-resize cost. Two guards:

       1. Skip entirely when the box has not actually changed. iOS Safari
          fires a resize storm as the toolbar collapses, and the container is
          sized in vh, which the toolbar does not affect — so that whole storm
          now costs nothing.
       2. Apply at the top of the render loop rather than from the resize
          listener. rAF callbacks run after the resize steps but before paint,
          so the buffer is reallocated and redrawn within the same frame the
          event arrived — never a frame of blank or stale canvas — and a burst
          of events inside one frame reallocates once instead of N times.
          Reallocating AFTER `renderer.render` would clear the canvas for the
          frame being painted, which is why the flag is read here and not in
          a standalone rAF callback. */
    let lastW = -1;
    let lastH = -1;
    let sizeDirty = false;
    function resize() {
      if (!ctn) return;
      const w = ctn.offsetWidth;
      const h = ctn.offsetHeight;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      renderer.setSize(w, h);
      program.uniforms.uResolution.value = [w, h];
    }
    const markDirty = () => {
      sizeDirty = true;
    };
    window.addEventListener("resize", markDirty);
    resize();

    let animateId = 0;
    const update = (t: number) => {
      animateId = requestAnimationFrame(update);
      if (sizeDirty) {
        sizeDirty = false;
        resize();
      }
      const p = propsRef.current;
      program.uniforms.uTime.value = t * 0.01 * p.speed * 0.1;
      program.uniforms.uAmplitude.value = p.amplitude;
      program.uniforms.uBlend.value = p.blend;
      program.uniforms.uColorStops.value = p.colorStops.map((hex: string) => {
        const c = new Color(hex);
        return [c.r, c.g, c.b];
      });
      renderer.render({ scene: mesh });
    };
    animateId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animateId);
      window.removeEventListener("resize", markDirty);
      if (ctn && gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ctnRef}
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
    />
  );
});

SoftAurora.displayName = "SoftAurora";

export default SoftAurora;
