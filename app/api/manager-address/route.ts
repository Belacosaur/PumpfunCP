import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('http://localhost:3001/api/manager-address');
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to get manager address:', error);
    return NextResponse.json(
      { error: 'Failed to get manager address' },
      { status: 500 }
    );
  }
} 