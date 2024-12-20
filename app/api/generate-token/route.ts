import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative token name generator. Generate a fun, memorable name for a meme token, its symbol (2-4 characters), and a brief description."
        },
        {
          role: "user",
          content: "Generate a token name, symbol, and description in JSON format with fields: name, symbol, description"
        }
      ],
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || '{}');

    // Generate image with more specific prompt
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a simple, iconic cryptocurrency token logo for ${response.name}. The design should be minimal, memorable, and work well as a small icon. Use bold colors and simple shapes. Make it suitable for a token logo.`,
      n: 1,
      size: "1024x1024",
      response_format: 'b64_json'
    });

    if (!image.data[0].b64_json) {
      throw new Error('Failed to generate image');
    }

    return new NextResponse(
      JSON.stringify({
        name: response.name || 'Default Token',
        symbol: response.symbol || 'TKN',
        description: response.description || 'A new meme token',
        imageBase64: `data:image/png;base64,${image.data[0].b64_json}`
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error generating token details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 