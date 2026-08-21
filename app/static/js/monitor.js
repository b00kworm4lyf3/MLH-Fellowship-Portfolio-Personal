/* ============================================================
   monitor.js — the persistent chrome frame backdrop.
   Renders the chrome housing + recessed organic "screen" into a
   full-viewport canvas behind the page. Shape + material params
   are baked from the testbed. Only the cursor is dynamic.

   Field space: y in [-1, 1], x scaled by aspect (÷ 0.5*height).
   The same vw/vh mapping is mirrored in monitor.css to place the
   screen content — keep them in sync if you retune the shape.
   ============================================================ */
(() => {
  const canvas = document.getElementById('monitor-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { document.documentElement.classList.add('no-webgl'); return; }

  const VERT = `attribute vec2 a_pos; void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `
    precision highp float;
    uniform vec2 u_res;
    uniform vec2 u_mouse;   // cursor in field space

    // --- baked shape (from the testbed) ---
    const vec2  A = vec2(-0.38, 0.01);  const float RA = 0.59;
    const vec2  B = vec2( 0.17, 0.08);  const float RB = 0.42;
    const vec2  C = vec2( 0.64,-0.32);  const float RC = 0.31;
    const float K      = 0.38;   // smooth-min blend
    const float BEVEL  = 0.14;   // recessed lip width
    const float SLOPE  = 0.76;   // bevel roundness (0 steep .. 1 shallow)
    const float SHINE  = 37.0;   // specular tightness
    const float LIGHTI = 0.40;   // cursor light intensity

    // --- palette ---
    const vec3 C_AMB_HI = vec3(0.52, 0.50, 0.60); // chrome facing the viewer
    const vec3 C_AMB_LO = vec3(0.16, 0.14, 0.22); // chrome tilted away
    const vec3 C_LIGHT  = vec3(1.00, 0.92, 0.98); // cursor light colour
    const vec3 C_LIP    = vec3(1.00, 0.40, 0.73); // pink spec tint
    const vec3 C_ACCENT = vec3(0.69, 0.36, 1.00); // purple
    const vec3 C_SCREEN = vec3(0.07, 0.05, 0.12); // recessed screen floor

    float sdCircle(vec2 p, vec2 c, float r){ return length(p - c) - r; }
    float smin(float a, float b, float k){
      float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);
      return mix(b, a, h) - k*h*(1.0 - h);
    }
    float map(vec2 p){
      float d = smin(sdCircle(p, A, RA), sdCircle(p, B, RB), K);
      d = smin(d, sdCircle(p, C, RC), K);
      return d;
    }
    vec2 grad(vec2 p, float e){
      return vec2(map(p+vec2(e,0.0)) - map(p-vec2(e,0.0)),
                  map(p+vec2(0.0,e)) - map(p-vec2(0.0,e)));
    }

    void main(){
      vec2 p = (gl_FragCoord.xy - 0.5*u_res) / (0.5*u_res.y);
      float e  = 1.5 / u_res.y;
      float aa = 2.0 / u_res.y;
      float d  = map(p);

      // beveled surface normal from the 2D field (see testbed notes)
      float t      = clamp(d / BEVEL, 0.0, 1.0);
      float rimAng = mix(0.0, 1.2, SLOPE);
      float ang    = mix(rimAng, 1.5708, t);
      vec2  gdir = normalize(grad(p, e) + 1e-6);
      vec3  n = normalize(vec3(-gdir * cos(ang), sin(ang)));

      // ---- lighting: soft ambient + cursor key (no fixed environment) ----
      vec3 amb = mix(C_AMB_LO, C_AMB_HI, clamp(n.z, 0.0, 1.0));

      vec3 L = normalize(vec3(u_mouse, 0.55) - vec3(p, 0.0));
      float diff = max(dot(n, L), 0.0);
      vec3  H = normalize(L + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(dot(n, H), 0.0), SHINE) * LIGHTI;

      vec3 chrome = amb
                  + C_LIGHT * diff * LIGHTI * 0.6
                  + mix(vec3(1.0), C_LIP, 0.35) * spec;
      // faint metallic rim so the lip keeps a glint
      chrome += mix(C_ACCENT, vec3(1.0), 0.4) * pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0) * 0.12;

      // ---- recessed screen (AO holds the depth without a directional light) ----
      float depth = smoothstep(0.0, BEVEL*1.4, -d);
      vec3 screen = mix(C_SCREEN*0.5, C_SCREEN, depth);
      screen += C_ACCENT * 0.05 * (1.0 - smoothstep(0.0, 0.9, length(p)));

      float inside = 1.0 - smoothstep(-aa, aa, d);
      gl_FragColor = vec4(mix(chrome, screen, inside), 1.0);
    }
  `;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  let mouse = [0.0, 0.2];
  window.addEventListener('mousemove', (e) => {
    const W = window.innerWidth, Hh = window.innerHeight;
    mouse = [(e.clientX - 0.5*W) / (0.5*Hh), -(e.clientY - 0.5*Hh) / (0.5*Hh)];
  });

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  (function frame(){
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  })();

  // let a vertical wheel scroll the screen sideways (screens page left/right)
  const screen = document.getElementById('screen');
  if (screen){
    screen.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        screen.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  // draw the stumble spiral
  const spiral = document.getElementById('stumble-path');
  if (spiral){
    let d = '';
    const cx = 34, cy = 34, turns = 3.2, steps = 120, maxR = 26;
    for (let i = 0; i <= steps; i++){
      const tt = i / steps, a = tt * turns * 2 * Math.PI, r = tt * maxR;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    spiral.setAttribute('d', d);
  }

  // stumble button -> jump to a random page (URLs come from the data-links attribute)
  const stumbleBtn = document.getElementById('stumble-btn');
  if (stumbleBtn){
    stumbleBtn.addEventListener('click', () => {
      let links = [];
      try { links = JSON.parse(stumbleBtn.dataset.links || '[]'); } catch (e) { /* ignore */ }
      if (links.length) location.href = links[Math.floor(Math.random() * links.length)];
    });
  }
})();