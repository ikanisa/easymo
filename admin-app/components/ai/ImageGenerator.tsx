'use client';

import { useState } from 'react';
import { Wand2, Download, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
  model: string;
  size: string;
}

interface ImageGeneratorProps {
  onImageGenerated?: (image: GeneratedImage) => void;
}

export function ImageGenerator({ onImageGenerated }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  
  // Settings
  const [model, setModel] = useState<'dall-e-3' | 'dall-e-2' | 'imagen-3'>('dall-e-3');
  const [size, setSize] = useState('1024x1024');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [style, setStyle] = useState<'vivid' | 'natural'>('vivid');
  const [numImages, setNumImages] = useState(1);
  const [guidanceScale, setGuidanceScale] = useState([7]);
  const [useNegativePrompt, setUseNegativePrompt] = useState(false);

  const generateImages = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    try {
      const response = await fetch('/api/ai/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: model.startsWith('dall-e') ? 'openai' : 'google',
          model,
          prompt: prompt.trim(),
          negativePrompt: useNegativePrompt ? negativePrompt.trim() : undefined,
          size,
          quality,
          style,
          n: numImages,
          guidanceScale: guidanceScale[0]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate images');
      }

      const data = await response.json();
      
      const newImages: GeneratedImage[] = data.images.map((img: any) => ({
        id: crypto.randomUUID(),
        url: img.url,
        prompt: prompt.trim(),
        timestamp: new Date(),
        model,
        size
      }));

      setImages(prev => [...newImages, ...prev]);
      newImages.forEach(img => onImageGenerated?.(img));

    } catch (error) {
      console.error('Image generation failed:', error);
      alert('Failed to generate images. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-image-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const regenerate = (oldPrompt: string) => {
    setPrompt(oldPrompt);
    setTimeout(() => generateImages(), 100);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Panel - Controls */}
      <Card className="p-6 space-y-6 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Image Generator</h3>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={(v) => setModel(v as any)}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dall-e-3">DALL·E 3</SelectItem>
                  <SelectItem value="dall-e-2">DALL·E 2</SelectItem>
                  <SelectItem value="imagen-3">Imagen 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A serene landscape with mountains and a lake at sunset..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {prompt.length} characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger id="size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {model === 'dall-e-3' ? (
                    <>
                      <SelectItem value="1024x1024">Square (1024×1024)</SelectItem>
                      <SelectItem value="1792x1024">Landscape (1792×1024)</SelectItem>
                      <SelectItem value="1024x1792">Portrait (1024×1792)</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="256x256">256×256</SelectItem>
                      <SelectItem value="512x512">512×512</SelectItem>
                      <SelectItem value="1024x1024">1024×1024</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {model.startsWith('dall-e') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="quality">Quality</Label>
                  <Select value={quality} onValueChange={(v) => setQuality(v as any)}>
                    <SelectTrigger id="quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="hd">HD (2x cost)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">Style</Label>
                  <Select value={style} onValueChange={(v) => setStyle(v as any)}>
                    <SelectTrigger id="style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vivid">Vivid</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="num-images">Number of Images</Label>
                <span className="text-sm text-muted-foreground">{numImages}</span>
              </div>
              <Slider
                id="num-images"
                min={1}
                max={model === 'dall-e-3' ? 1 : 4}
                step={1}
                value={[numImages]}
                onValueChange={(v) => setNumImages(v[0])}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="guidance">Guidance Scale</Label>
                <span className="text-sm text-muted-foreground">{guidanceScale[0]}</span>
              </div>
              <Slider
                id="guidance"
                min={1}
                max={20}
                step={0.5}
                value={guidanceScale}
                onValueChange={setGuidanceScale}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="negative-prompt-toggle">Negative Prompt</Label>
              <Switch
                id="negative-prompt-toggle"
                checked={useNegativePrompt}
                onCheckedChange={setUseNegativePrompt}
              />
            </div>

            {useNegativePrompt && (
              <div className="space-y-2">
                <Textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="blurry, low quality, distorted..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button
          onClick={generateImages}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4 mr-2" />
              Generate {numImages > 1 ? `${numImages} Images` : 'Image'}
            </>
          )}
        </Button>
      </Card>

      {/* Right Panel - Generated Images */}
      <Card className="p-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold">Generated Images</h3>
          <Badge variant="secondary">{images.length} total</Badge>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Wand2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">No images yet</p>
            <p className="text-sm">
              Enter a prompt and click generate to create AI images
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div key={image.id} className="group relative">
                <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>

                {/* Overlay Controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadImage(image.url, index)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => regenerate(image.prompt)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </Button>
                </div>

                {/* Image Info */}
                <div className="mt-2 space-y-1">
                  <p className="text-sm line-clamp-2">{image.prompt}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {image.model}
                    </Badge>
                    <span>{image.size}</span>
                    <span>·</span>
                    <span>{image.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
