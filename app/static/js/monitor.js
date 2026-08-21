/* ============================================================
   monitor.js — chrome housing + recessed organic screen.
   Full-viewport canvas behind the page. Shape/material baked;
   cursor is the only live uniform. Menu pads are drawn in the
   shader so they share the chrome material + cursor light; the
   <a> labels in base.html sit over them via matching vh math.
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
    uniform vec2 u_mouse;

    const vec2  A = vec2(-0.38, 0.01); const float RA = 0.59;
    const vec2  B = vec2( 0.17, 0.08); const float RB = 0.42;
    const vec2  C = vec2( 0.64,-0.32); const float RC = 0.31;
    const float K = 0.38;
    const float SCALE  = 1.6;              // <-- blob size. bigger number = bigger monitor
    const vec2  OFFSET = vec2(0.35,-0.05); // <-- shifts the blob right to clear the menu
    const float BEVEL  = 0.22;
    const float SLOPE  = 0.76;
    const float EBW = 0.03;   // menu-pad emboss width
    const float EMB = 1.0;    // menu-pad emboss strength

    const vec3 C_ACCENT = vec3(0.69, 0.36, 1.00);
    const vec3 C_PINK   = vec3(1.00, 0.24, 0.65);
    const vec3 C_SCREEN = vec3(0.06, 0.045, 0.11);

    float sdCircle(vec2 p, vec2 c, float r){ return length(p-c)-r; }
    float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return min(max(q.x,q.y),0.0)+length(max(q,0.0))-r; }
    float smin(float a, float b, float k){ float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
    float blob(vec2 p){ float d=smin(sdCircle(p,A,RA),sdCircle(p,B,RB),K); d=smin(d,sdCircle(p,C,RC),K); return d; }
    float scene(vec2 p){ return blob((p-OFFSET)/SCALE)*SCALE; }
    vec2 gScene(vec2 p, float e){ return vec2(scene(p+vec2(e,0.0))-scene(p-vec2(e,0.0)), scene(p+vec2(0.0,e))-scene(p-vec2(0.0,e))); }

    // five menu pads, stacked on the left. (If you change the number of
    // nav links, change the 5 here AND the labels in base.html.)
    float menu(vec2 p){
      float m = 1e5;
      for(int i=0;i<5;i++){ float yy = 0.30 - float(i)*0.15; m = min(m, sdRoundBox(p - vec2(-1.60, yy), vec2(0.13,0.055), 0.02)); }
      return m;
    }
    vec2 gMenu(vec2 p, float e){ return vec2(menu(p+vec2(e,0.0))-menu(p-vec2(e,0.0)), menu(p+vec2(0.0,e))-menu(p-vec2(0.0,e))); }

    // glossy purple-tinted chrome reflected by the surface normal
    vec3 envChrome(vec3 n){
      float up = n.y*0.5 + 0.5;
      vec3 c = mix(vec3(0.05,0.04,0.10), vec3(0.70,0.66,0.86), up*up);           // deep violet -> bright lavender
      c += vec3(0.95,0.90,1.0) * smoothstep(0.58,0.70,up)*(1.0-smoothstep(0.70,0.9,up)) * 0.55; // hot reflection band
      return c;
    }

    void main(){
      vec2 p = (gl_FragCoord.xy - 0.5*u_res) / (0.5*u_res.y);
      float e = 1.5/u_res.y, aa = 2.0/u_res.y;
      float d = scene(p);

      float t = clamp(d/BEVEL, 0.0, 1.0);
      float ang = mix(mix(0.0,1.2,SLOPE), 1.5708, t);
      vec2 gdir = normalize(gScene(p,e)+1e-6);
      vec3 n = normalize(vec3(-gdir*cos(ang), sin(ang)));

      // emboss the menu pads into the chrome (raised rims)
      if(d > 0.0){
        float mb = menu(p);
        float band = 1.0 - smoothstep(0.0, EBW, abs(mb));
        if(band > 0.001){ vec2 gb = normalize(gMenu(p,e)+1e-6); n = normalize(n + vec3(gb*band*EMB, 0.0)); }
      }

      float facing = clamp(n.z, 0.0, 1.0);
      vec3 chrome = envChrome(n);
      chrome += mix(vec3(1.0), C_ACCENT, 0.35) * pow(1.0-facing, 3.0) * 0.5;      // fresnel glint
      float pool = smoothstep(1.6, 0.0, length(p-u_mouse));
      vec3 Lc = normalize(vec3(u_mouse,0.6) - vec3(p,0.0));
      vec3 Hc = normalize(Lc + vec3(0.0,0.0,1.0));
      chrome += mix(vec3(1.0), C_PINK, 0.3) * pow(max(dot(n,Hc),0.0), 40.0) * pool * 0.6;  // cursor highlight

      float depth = smoothstep(0.0, BEVEL*1.4, -d);
      vec3 screen = mix(C_SCREEN*0.6, C_SCREEN, depth);
      screen += mix(C_ACCENT, C_PINK, 0.5) * 0.10 * (1.0 - smoothstep(0.0, 1.5, length(p-OFFSET)));
      screen += C_ACCENT * smoothstep(-0.16, 0.0, d) * 0.30;                      // inner rim glow

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

  let mouse = [0.4, 0.15];
  window.addEventListener('mousemove', (e) => {
    const W = window.innerWidth, H = window.innerHeight;
    mouse = [(e.clientX - 0.5*W) / (0.5*H), -(e.clientY - 0.5*H) / (0.5*H)];
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

  // stumble spiral
  const spiral = document.getElementById('stumble-path');
  if (spiral){
    let d = ''; const cx = 34, cy = 34, turns = 3.2, steps = 120, maxR = 26;
    for (let i = 0; i <= steps; i++){
      const tt = i/steps, a = tt*turns*2*Math.PI, r = tt*maxR;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a)*r).toFixed(1) + ' ' + (cy + Math.sin(a)*r).toFixed(1);
    }
    spiral.setAttribute('d', d);
  }

  // stumble -> open one of your sites in a NEW TAB (URLs from data-links)
  const stumbleBtn = document.getElementById('stumble-btn');
  if (stumbleBtn){
    stumbleBtn.addEventListener('click', () => {
      let links = [];
      try { links = JSON.parse(stumbleBtn.dataset.links || '[]'); } catch (e) { /* ignore */ }
      if (links.length){
        const url = links[Math.floor(Math.random() * links.length)];
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    });
  }
})();