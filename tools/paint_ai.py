"""
Paints the backdrops on the local graphics card with Stable Diffusion XL. The 3D scenes keep the
composition: their depth drives a ControlNet, so that every column, the pyramid and the doors stay
where the game expects them and the live light still falls in the right place.

  HF_HOME=C:/Users/qs894/ai-paint/hf  C:/Users/qs894/ai-paint/venv/Scripts/python tools/paint_ai.py <scene> [seed]

It writes tools/out/ai_<scene>_<seed>.png. Scenes are hall, night and red. SDXL and its ControlNet
are under CreativeML Open RAIL++-M, which allows commercial use of the images.
"""
import sys

import numpy as np
import torch
from diffusers import AutoencoderKL, ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionXLControlNetImg2ImgPipeline
from PIL import Image

STYLE = 'epic matte painting, premium slot game background art, ultra detailed, intricate, cinematic lighting, volumetric light, rich colors, sharp focus, 8k'
NEGATIVE = 'text, letters, watermark, signature, logo, people, person, figure, cartoon, flat colors, low quality, lowres, blurry, plastic, toy, deformed, jpeg artifacts, oversaturated'

SCENES = {
    'hall': {
        'init': 'tools/out/view_hall.png',
        'depth': 'tools/out/temple_depth.png',
        'prompt': 'interior of a colossal ancient egyptian hypostyle hall at night, giant painted columns with papyrus capitals, lapis lazuli blue panels with carved gold hieroglyphs, polished black marble floor with gold inlay and mirror reflections, weathered limestone sphinx statues along the central aisle, a golden bronze gate glowing at the end, the great pyramid and a full moon beyond, starry sky, warm golden light against cold blue moonlight',
    },
    'night': {
        'init': 'tools/out/view_night.png',
        'depth': 'tools/out/pyramid_depth.png',
        'prompt': 'the great pyramid of giza at night, huge ancient limestone blocks, a bronze and gold door at its base, two colossal weathered stone sphinx statues guarding a polished black causeway, tall red granite obelisks with carved hieroglyphs and gold tips, full moon, deep blue night sky full of stars, thin clouds, mysterious, moonlight',
    },
    'red': {
        'init': 'tools/out/view_red.png',
        'depth': 'tools/out/pyramid_depth.png',
        'prompt': 'the great pyramid of giza split open by glowing molten lava cracks, cursed and infected, black stone blocks lit from within, blood red storm sky with towering dark clouds, blood moon, obelisks with burning hieroglyphs, two colossal dark stone sphinx statues with glowing eyes, wet black obsidian causeway reflecting the fire, embers and ash in the air, hellish, dark, high contrast, deep shadows, dramatic red and orange glow',
    },
}


def build():
    dtype = torch.float16
    control = ControlNetModel.from_pretrained('diffusers/controlnet-depth-sdxl-1.0', variant='fp16', torch_dtype=dtype, use_safetensors=True)
    vae = AutoencoderKL.from_pretrained('madebyollin/sdxl-vae-fp16-fix', torch_dtype=dtype, use_safetensors=True)
    pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pretrained(
        'stabilityai/stable-diffusion-xl-base-1.0', controlnet=control, vae=vae, variant='fp16', torch_dtype=dtype, use_safetensors=True,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True, algorithm_type='dpmsolver++')
    pipe.to('cuda')
    pipe.vae.enable_tiling()
    return pipe


def run(pipe, scene, seed, size, init, strength, control, steps=34):
    s = SCENES[scene]
    depth = Image.open(s['depth']).convert('RGB').resize(size, Image.BICUBIC)
    return pipe(
        prompt=f"{s['prompt']}, {STYLE}",
        negative_prompt=NEGATIVE,
        image=init.resize(size, Image.LANCZOS),
        control_image=depth,
        strength=strength,
        controlnet_conditioning_scale=control,
        guidance_scale=6.5,
        num_inference_steps=steps,
        generator=torch.Generator('cuda').manual_seed(seed),
    ).images[0]


def main():
    scene = sys.argv[1]
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    strength = float(sys.argv[3]) if len(sys.argv) > 3 else 0.78
    pipe = build()
    init = Image.open(SCENES[scene]['init']).convert('RGB')
    first = run(pipe, scene, seed, (1536, 864), init, strength, 0.72)
    first.save(f'tools/out/ai_{scene}_{seed}_a.png')
    # the same picture again, larger: this pass adds the fine detail without changing what is there
    final = run(pipe, scene, seed + 1, (2240, 1260), first, 0.34, 0.5, 28)
    final.save(f'tools/out/ai_{scene}_{seed}.png')
    final.resize((1520, 855), Image.LANCZOS).convert('RGB').save(f'tools/out/ai_{scene}_{seed}.jpg', quality=90)
    print('painted', scene, seed)


if __name__ == '__main__':
    main()
