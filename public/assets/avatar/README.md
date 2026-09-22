# AgentiCuantico — avatar 3D facial

El escenario usa Three.js/WebGL y carga un GLB con rig corporal y blendshapes faciales cuando está disponible.

## Runtime

- Archivo principal: `/public/app.js`
- Canvas: `#avatarCanvas`
- Contenedor: `#robotAvatar`
- Estado: `#avatarRigStatus`
- Configuración opcional: `window.AGENTICUANTICO_AVATAR_GLB`

Por defecto se utiliza el modelo **MPFB** publicado por el proyecto TalkingHead. Su README identifica ese archivo como CC0. Se usa como fallback abierto mientras se incorpora el modelo humano hiperrealista propio de AgentiCuantico.

## Para la chica hiperrealista definitiva

El asset recomendado debe ser un `.glb` propio/licenciado con:

- cuerpo femenino realista;
- rig humanoide;
- ojos y mirada;
- huesos de cabeza/cuello/columna/brazos;
- ARKit 52 blendshapes o Oculus visemes;
- `jawOpen`, `mouthSmileLeft/Right`, `mouthFunnel`, `mouthPucker`, `mouthClose`;
- `eyeBlinkLeft/Right`;
- texturas PBR de piel, ojos, cabello y ropa;
- animaciones idle/talking/gestures.

El renderer detecta automáticamente `morphTargetDictionary` y `morphTargetInfluences` y aplica movimiento de boca, mandíbula, ojos, parpadeo y expresiones.

## Lip-sync

El puente `window.AgentiCuanticoAvatar.speak(text, options)` sincroniza una línea temporal de visemas aproximados con la reproducción de voz del navegador. Para sincronización fonema-a-fonema de máxima precisión, el backend debe proporcionar audio + timestamps/visemes; el renderer ya acepta esos morph targets.

No se debe distribuir en producción un modelo de terceros sin comprobar su licencia.

## Avatar local prototype

The runtime now prefers `./assets/avatar/agentic-quantico-avatar-small.glb` before falling back to a remote/default avatar. The current prototype is a 2.5D depth-relief GLB based on the provided AgenticCuantico reference and does not contain a true humanoid skeleton or ARKit morph targets.

The facial rig also exposes hand/wrist gesture support for future humanoid GLBs: hand, wrist, thumb, index, middle, ring and little-finger bones are detected and animated during idle/speaking states. A real hand skeleton must exist in the GLB for those controls to move actual fingers.
