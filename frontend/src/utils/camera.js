export async function startCamera(videoRef) {
  // Check if getUserMedia is available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera API not available. Use HTTPS or localhost.")
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  })

  if (videoRef.current) {
    videoRef.current.srcObject = stream
    // Ensure playback starts
    await videoRef.current.play().catch(() => {})
  }
}

export function captureFrame(videoRef, canvasRef) {
  const video = videoRef.current
  const canvas = canvasRef.current

  if (!video || !canvas) return Promise.resolve(null)

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext("2d")
  ctx.drawImage(video, 0, 0)

  return new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg")
  })
}

export function stopCamera(videoRef) {
  const stream = videoRef.current?.srcObject

  if (!stream) return

  stream.getTracks().forEach(track => track.stop())
  if (videoRef.current) {
    videoRef.current.srcObject = null
  }
}