export async function generateTokenDetails() {
  try {
    const response = await fetch('/api/generate-token', {
      method: 'POST'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate token details');
    }

    const data = await response.json();

    // Convert base64 to Blob then to File
    const base64Data = data.imageBase64.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: 'image/png' });
    const imageFile = new File([blob], "token-logo.png", { type: "image/png" });

    return {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      file: imageFile
    };
  } catch (error) {
    console.error('Error generating token details:', error);
    throw error;
  }
} 