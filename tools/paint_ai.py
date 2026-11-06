"""
Paints the backdrops on the local graphics card with Stable Diffusion XL. The 3D scenes keep the
composition: their depth drives a ControlNet, so that every column, the pyramid and the doors stay
where the game expects them and the live light still falls in the right place.

  HF_HOME=C:/Users/qs894/ai-paint/hf  C:/Users/qs894/ai-paint/venv/Scripts/python tools/paint_ai.py sweep <scene> 1,2,3,4 [strength]
  ... paint_ai.py final <scene> <seed> [strength]

sweep paints quick versions side by side in tools/out/sweep_<scene>.jpg, final the chosen one in
tools/out/ai_<scene>.png, detail repaints the sphinxes of a final picture up close, and sky paints
the storm of the bonus alone. red repaints the finished bonus (tools/out/red_base.png) over itself
into the apocalypse, and upscale <file> brings any picture to 3840 × 2160 tile by tile, adding the
detail an enlargement cannot invent. objects <name,name> <seeds> paints props alone on black, for
tools/finish_ai.py to cut out and set into a scene. Scenes are hall and night. SDXL and its ControlNet are under
CreativeML Open RAIL++-M, which allows commercial use of the images.
"""
import sys

import numpy as np
import torch
from diffusers import AutoencoderKL, ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionXLControlNetImg2ImgPipeline
from PIL import Image

# what goes to the second text encoder: the first one stops at 77 tokens, and the scene needs them all
STYLE = 'epic dark matte painting, premium slot game background art, ultra detailed, intricate, cinematic lighting, volumetric light, deep shadows, strong contrast, 8k'
NEGATIVE = 'sun, daylight, text, letters, watermark, signature, logo, people, person, figure, cartoon, flat colors, low quality, lowres, blurry, plastic, toy, deformed, jpeg artifacts'

SCENES = {
    'hall': {
        'init': 'tools/out/view_hall.png',
        'depth': 'tools/out/temple_depth.png',
        'prompt': 'colossal ancient egyptian hypostyle hall at night, giant painted columns with papyrus capitals, lapis lazuli panels with gold hieroglyphs, polished black marble floor with gold inlay and reflections, weathered limestone sphinx statues, glowing golden bronze gate, great pyramid and full moon beyond, starry sky',
    },
    'night': {
        'init': 'tools/out/view_night.png',
        'depth': 'tools/out/pyramid_depth.png',
        'prompt': 'the great pyramid of giza at night, huge ancient limestone blocks, bronze and gold door at its base, two colossal weathered stone sphinx statues, polished black marble floor with reflections, tall red granite obelisks with hieroglyphs and gold tips, full moon, deep blue starry sky',
    },
}


# the sphinxes in the 2048 × 1152 pictures: the whole statue, then its head alone, closer
SPHINX = 'ancient egyptian sphinx statue, carved weathered limestone, noble human pharaoh face, striped nemes headdress, lion body with great paws, photorealistic stone, real monument of giza'
HEAD = 'close view of the head of the great sphinx of giza, noble serene human pharaoh face, almond eyes, straight nose, full lips, striped royal nemes headdress, carved weathered limestone, photorealistic'
NOT_ANIMAL = NEGATIVE + ', lion face, animal face, muzzle, snout, fur, whiskers, monster, demon, mask'
def statue_boxes():
    """The left sphinx, and its head, in the 2048 × 1152 picture, from the materials of the render."""
    ids = np.asarray(Image.open('tools/out/pyramid_ids.png').resize((2048, 1152), Image.NEAREST), dtype=np.int32) // 20

    def box(mask, pad):
        mask[:, 1024:] = False
        rows, cols = np.nonzero(mask)
        return tuple(int(v) for v in (max(0, cols.min() - pad), max(0, rows.min() - pad), min(1024, cols.max() + pad), min(1152, rows.max() + pad)))

    return box(np.isin(ids, (9, 10, 11)), 26), box(np.isin(ids, (10, 11)), 22)


def details(scene):
    body, head = statue_boxes()
    # the right one is the mirror of the left, set by tools/finish_ai.py
    return [(SPHINX, body, 0.5), (HEAD, head, 0.62)] if scene == 'night' else []


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


def detail(pipe, scene, seed):
    """Each statue is repainted large in its own crop and laid back with soft edges."""
    from PIL import ImageDraw, ImageFilter
    picture = Image.open(f'tools/out/ai_{scene}.png').convert('RGB')
    depth = Image.open(SCENES[scene]['depth']).convert('RGB')
    k = depth.width / picture.width
    for i, (prompt, (x0, y0, x1, y1), strength) in enumerate(details(scene)):
        w, h = x1 - x0, y1 - y0
        z = 1024 / max(w, h)
        size = (int(w * z) // 8 * 8, int(h * z) // 8 * 8)
        crop = picture.crop((x0, y0, x1, y1)).resize(size, Image.LANCZOS)
        dcrop = depth.crop((int(x0 * k), int(y0 * k), int(x1 * k), int(y1 * k))).resize(size, Image.BICUBIC)
        done = pipe(
            prompt=prompt, prompt_2=STYLE, negative_prompt=NOT_ANIMAL, image=crop, control_image=dcrop, strength=strength,
            controlnet_conditioning_scale=0.6, guidance_scale=7, num_inference_steps=32, generator=torch.Generator('cuda').manual_seed(seed + i),
        ).images[0].resize((w, h), Image.LANCZOS)
        edge = max(8, min(w, h) // 8)
        mask = Image.new('L', (w, h), 0)
        ImageDraw.Draw(mask).rectangle((edge, edge, w - edge, h - edge), fill=255)
        picture.paste(done, (x0, y0), mask.filter(ImageFilter.GaussianBlur(edge * 0.6)))
    picture.save(f'tools/out/ai_{scene}.png')
    picture.resize((1520, 855), Image.LANCZOS).save(f'tools/out/ai_{scene}.jpg', quality=90)


def statue(pipe, seeds):
    """One sphinx alone on black, from a sharp depth map: the avenue of the hall is made of it."""
    size = (1216, 832)
    init = Image.open('tools/out/sphinx_init.png').convert('RGB')
    depth = Image.open('tools/out/sphinx_depth.png').convert('RGB')
    shots = []
    for seed in seeds:
        im = pipe(
            prompt='the great sphinx of giza, ancient egyptian limestone statue, noble human pharaoh face, striped nemes headdress, lion body lying down with great paws, on a carved stone plinth, plain black background',
            prompt_2='photorealistic carved weathered stone, museum photograph, ultra detailed, sharp focus, 8k',
            negative_prompt=NOT_ANIMAL, image=init, control_image=depth, strength=0.9, controlnet_conditioning_scale=0.9, guidance_scale=7, num_inference_steps=36,
            generator=torch.Generator('cuda').manual_seed(seed),
        ).images[0]
        im.save(f'tools/out/ai_sphinx_{seed}.png')
        shots.append(im)
    W, H = 760, 520
    sheet = Image.new('RGB', (W * 2, H * ((len(shots) + 1) // 2)))
    for i, im in enumerate(shots):
        sheet.paste(im.resize((W, H), Image.LANCZOS), ((i % 2) * W, (i // 2) * H))
    sheet.save('tools/out/sweep_sphinx.jpg', quality=90)


RED = (
    'colossal black obsidian great pyramid split by glowing molten lava veins, magma light pouring from the cracks, '
    'lightning striking its golden apex, swirling apocalyptic storm vortex of crimson clouds, blood moon, '
    'obelisks with burning hieroglyphs, two giant stone sphinx statues with glowing red eyes, embers and ash in the air, '
    'wet black obsidian floor reflecting the fire'
)
RED_STYLE = 'epic dark fantasy matte painting, AAA slot game bonus background, hyper detailed, volumetric red light, high contrast, deep blacks, cinematic, 8k'


def red(pipe, seeds):
    """The finished bonus, repainted over itself: the composition stays, the matter becomes fire."""
    base = Image.open('tools/out/red_base.png').convert('RGB')
    depth = Image.open(SCENES['night']['depth']).convert('RGB')
    shots = []
    for seed in seeds:
        im = pipe(
            prompt=RED, prompt_2=RED_STYLE, negative_prompt=NEGATIVE + ', daylight, blue sky, flat red',
            image=base.resize((1344, 768), Image.LANCZOS), control_image=depth.resize((1344, 768), Image.BICUBIC),
            strength=0.5, controlnet_conditioning_scale=0.6, guidance_scale=7, num_inference_steps=32,
            generator=torch.Generator('cuda').manual_seed(seed),
        ).images[0]
        im.save(f'tools/out/ai_red_{seed}.png')
        shots.append(im)
    W, H = 760, 434
    sheet = Image.new('RGB', (W * 2, H * ((len(shots) + 1) // 2)))
    for i, im in enumerate(shots):
        sheet.paste(im.resize((W, H), Image.LANCZOS), ((i % 2) * W, (i // 2) * H))
    sheet.save('tools/out/sweep_red.jpg', quality=90)


def upscale(pipe, path, prompt, out, strength=0.3):
    """To 3840 × 2160: enlarged, then every tile repainted lightly and laid back with soft seams."""
    from PIL import ImageFilter
    W, H, T, O = 3840, 2160, 1024, 160
    big = Image.open(path).convert('RGB').resize((W, H), Image.LANCZOS)
    acc = np.zeros((H, W, 3), np.float32)
    weight = np.zeros((H, W, 1), np.float32)
    ramp = np.minimum(np.minimum(np.arange(T), np.arange(T)[::-1]) / O, 1).astype(np.float32)
    mask = np.minimum(ramp[:, None], ramp[None, :])[..., None] + 1e-3
    xs = list(range(0, W - T, T - O)) + [W - T]
    ys = list(range(0, H - T, T - O)) + [H - T]
    black = Image.new('RGB', (T, T), 0)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            tile = big.crop((x, y, x + T, y + T))
            done = pipe(
                prompt=prompt, prompt_2='ultra detailed, sharp focus, intricate texture, 8k', negative_prompt=NEGATIVE,
                image=tile, control_image=black, strength=strength, controlnet_conditioning_scale=0.0,
                guidance_scale=5, num_inference_steps=24, generator=torch.Generator('cuda').manual_seed(100 + j * 31 + i),
            ).images[0]
            acc[y : y + T, x : x + T] += np.asarray(done, dtype=np.float32) * mask
            weight[y : y + T, x : x + T] += mask
    img = Image.fromarray(np.clip(acc / weight, 0, 255).astype(np.uint8))
    img.save(out)
    img.resize((1520, 855), Image.LANCZOS).save(out.replace('.png', '.jpg'), quality=90)


def sky(pipe, seed):
    """The storm of the bonus, alone: nothing holds it to any shape."""
    size = (1344, 768)
    black = Image.new('RGB', size, 0)
    noise = Image.fromarray((np.random.default_rng(seed).random((768, 1344, 3)) * 80).astype(np.uint8))
    out = pipe(
        prompt='apocalyptic blood red storm sky, towering black and crimson cumulus clouds, lit from below by fire, forked lightning, glowing embers, night',
        prompt_2='epic dark matte painting, volumetric clouds, dramatic, deep shadows, ultra detailed, 8k',
        negative_prompt='sun, moon, ground, horizon, buildings, mountains, text, watermark, low quality, blurry',
        image=noise, control_image=black, strength=1.0, controlnet_conditioning_scale=0.0, guidance_scale=7, num_inference_steps=34,
        generator=torch.Generator('cuda').manual_seed(seed),
    ).images[0]
    out.resize((2048, 1152), Image.LANCZOS).save('tools/out/ai_sky.png')
    out.resize((1520, 868), Image.LANCZOS).save('tools/out/ai_sky.jpg', quality=90)


def run(pipe, scene, seed, size, init, strength, control, steps=34):
    s = SCENES[scene]
    depth = Image.open(s['depth']).convert('RGB').resize(size, Image.BICUBIC)
    return pipe(
        prompt=s['prompt'],
        prompt_2=STYLE,
        negative_prompt=NEGATIVE,
        image=init.resize(size, Image.LANCZOS),
        control_image=depth,
        strength=strength,
        controlnet_conditioning_scale=control,
        guidance_scale=6.5,
        num_inference_steps=steps,
        generator=torch.Generator('cuda').manual_seed(seed),
    ).images[0]


# Objects painted alone on black, to be cut out and set into a scene by tools/finish_ai.py
OBJECTS = {
    'chest': 'a golden treasure chest with its lid open, overflowing with gold coins and rubies, egyptian hieroglyph decorations, three-quarter view',
    'chest2': 'an ancient egyptian gilded wooden treasure chest carved with hieroglyphs, a scarab on its open lid, full of gold coins and jewels, three-quarter view',
    'hoard': 'a big pile of ancient gold coins with golden goblets, a golden crown, rubies and pearls spilling out, treasure hoard',
    'urn': 'a tall ancient egyptian golden urn with a lid, decorated with lapis lazuli bands and hieroglyphs, standing on a small black stone pedestal',
    'jar': 'a tall golden ancient egyptian canopic jar with a carved jackal head lid and lapis lazuli inlay, front view',
    'table': 'an ancient egyptian black granite offering table laden with golden vessels, golden cups and heaps of gold coins, three-quarter view',
    'vase': 'a tall slender golden ancient egyptian amphora vase with lapis lazuli and carnelian inlay, front view',
    'stele': 'a weathered ancient egyptian limestone stele slab with a rounded top, deeply carved with hieroglyphs and a winged sun disk, standing upright, front view',
    'drum': 'a fallen broken ancient egyptian stone column drum lying on its side, carved with hieroglyphs, weathered limestone',
    'brazier': 'an ancient egyptian golden offering bowl on a tall carved stone pedestal, empty, no fire',
    'altar': 'a small square ancient egyptian carved limestone offering altar, hieroglyphs on its sides, a golden bowl on top, three-quarter view',
    'blocks': 'a heap of broken ancient egyptian carved limestone blocks and a fallen column drum with hieroglyphs',
}


# the material sets the style: gold treasure shines, stone is weathered and matt
STONE = {'stele', 'drum', 'altar', 'blocks'}


def objects(pipe, names, seeds):
    """Each object alone on black, several takes side by side in tools/out/sheet_obj_<name>.jpg."""
    black = Image.new('RGB', (1024, 1024), 0)
    for name in names:
        shots = []
        for seed in seeds:
            im = pipe(
                prompt=f'{OBJECTS[name]}, isolated on a plain pure black background, single object, centered, full object visible',
                prompt_2=(
                    'photorealistic weathered sandstone and limestone, ancient ruin, game prop, 3d render, soft moonlight key light, ultra detailed, sharp focus, 8k'
                    if name in STONE else
                    'premium slot game prop, highly detailed 3d render, polished shiny gold, bright warm key light and rim light, ultra detailed, sharp focus, 8k'
                ),
                negative_prompt=NEGATIVE + ', background scenery, room, temple, landscape, cropped, person, statue, animal, dog, jackal, bitcoin, cryptocurrency, letter b, fire, flame'
                + (', gold, golden, metal, jewelry, ring, shiny, glossy' if name in STONE else ''),
                image=black, control_image=black, strength=1.0, controlnet_conditioning_scale=0.0, guidance_scale=7, num_inference_steps=32,
                generator=torch.Generator('cuda').manual_seed(seed),
            ).images[0]
            im.save(f'tools/out/obj_{name}_{seed}.png')
            shots.append(im)
        sheet = Image.new('RGB', (384 * len(shots), 384))
        for i, im in enumerate(shots):
            sheet.paste(im.resize((384, 384), Image.LANCZOS), (i * 384, 0))
        sheet.save(f'tools/out/sheet_obj_{name}.jpg', quality=88)


def main():
    mode, scene, seeds = sys.argv[1:4]
    strength = float(sys.argv[4]) if len(sys.argv) > 4 else (0.3 if mode == 'upscale' else 0.72)
    pipe = build()
    if mode == 'red':
        red(pipe, [int(x) for x in seeds.split(',')])
        return
    if mode == 'objects':
        # scene is a comma separated list of object names
        objects(pipe, scene.split(','), [int(x) for x in seeds.split(',')])
        return
    if mode == 'upscale':
        # scene is the input file, seeds the prompt key: hall, night or red
        prompts = {'hall': SCENES['hall']['prompt'], 'night': SCENES['night']['prompt'], 'red': RED}
        upscale(pipe, scene, prompts[seeds], scene.replace('.png', '_4k.png'), strength)
        return
    if mode == 'statue':
        statue(pipe, [int(x) for x in seeds.split(',')])
        return
    if mode == 'detail':
        detail(pipe, scene, int(seeds))
        return
    if mode == 'sky':
        sky(pipe, int(seeds))
        return
    init = Image.open(SCENES[scene]['init']).convert('RGB')
    if mode == 'sweep':
        shots = [run(pipe, scene, int(seed), (1344, 768), init, strength, 0.72, 26) for seed in seeds.split(',')]
        W, H = 760, 434
        sheet = Image.new('RGB', (W * 2, H * ((len(shots) + 1) // 2)))
        for i, im in enumerate(shots):
            sheet.paste(im.resize((W, H), Image.LANCZOS), ((i % 2) * W, (i // 2) * H))
        sheet.save(f'tools/out/sweep_{scene}.jpg', quality=90)
    else:
        seed = int(seeds)
        first = run(pipe, scene, seed, (1344, 768), init, strength, 0.72, 30)
        # the same picture again, larger: this pass adds the fine detail without changing what is there
        final = run(pipe, scene, seed + 1, (2048, 1152), first, 0.32, 0.5, 26)
        final.save(f'tools/out/ai_{scene}.png')
        final.resize((1520, 855), Image.LANCZOS).save(f'tools/out/ai_{scene}.jpg', quality=90)
    print('painted', scene, seeds)


if __name__ == '__main__':
    main()
