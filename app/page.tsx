"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, Volume2, Download, Play, Pause, Globe, VolumeX, AlertCircle } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"

interface Voice {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

interface LanguageGroup {
  code: string
  name: string
  voices: Voice[]
}

export default function TextToSpeechApp() {
  const [text, setText] = useState<string>(
    "Hello! This is a free text-to-speech converter. Try it out by typing your text here and clicking the play button.",
  )
  const [voices, setVoices] = useState<Voice[]>([])
  const [languageGroups, setLanguageGroups] = useState<LanguageGroup[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>("")
  const [selectedLanguage, setSelectedLanguage] = useState<string>("")
  const [rate, setRate] = useState<number>(1)
  const [pitch, setPitch] = useState<number>(1)
  const [volume, setVolume] = useState<number>(1)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [previousVolume, setPreviousVolume] = useState<number>(1)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [showRecordingAlert, setShowRecordingAlert] = useState<boolean>(false)
  const { toast } = useToast()

  const synth = useRef<SpeechSynthesis | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<BlobPart[]>([])
  const downloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      synth.current = window.speechSynthesis

      // Get available voices
      const loadVoices = () => {
        const availableVoices = synth.current?.getVoices() || []
        setVoices(availableVoices as Voice[])

        // Group voices by language
        const groups: { [key: string]: LanguageGroup } = {}

        availableVoices.forEach((voice) => {
          const langCode = voice.lang.split("-")[0]
          const langName = new Intl.DisplayNames([navigator.language], { type: "language" }).of(langCode) || langCode

          if (!groups[langCode]) {
            groups[langCode] = {
              code: langCode,
              name: langName,
              voices: [],
            }
          }

          groups[langCode].voices.push(voice as Voice)
        })

        setLanguageGroups(Object.values(groups).sort((a, b) => a.name.localeCompare(b.name)))

        // Set default voice and language
        if (availableVoices.length > 0) {
          const defaultVoice = availableVoices.find((voice) => voice.default) || availableVoices[0]
          setSelectedVoice(defaultVoice.name)

          const langCode = defaultVoice.lang.split("-")[0]
          setSelectedLanguage(langCode)
        }
      }

      // Chrome loads voices asynchronously
      if (synth.current?.onvoiceschanged !== undefined) {
        synth.current.onvoiceschanged = loadVoices
      }

      loadVoices()

      // Initialize speech recognition if available
      if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = ""
          let finalTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript
            } else {
              interimTranscript += event.results[i][0].transcript
            }
          }

          if (finalTranscript) {
            setText((prevText) => prevText + " " + finalTranscript)
          }
        }

        recognitionRef.current.onend = () => {
          if (isListening) {
            recognitionRef.current.start()
          }
        }
      }

      // Initialize audio context
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      } catch (e) {
        console.error("Web Audio API is not supported in this browser")
      }
    }

    return () => {
      if (synth.current) {
        synth.current.cancel()
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (downloadTimeoutRef.current) {
        clearTimeout(downloadTimeoutRef.current)
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Handle language change
  useEffect(() => {
    if (selectedLanguage && voices.length > 0) {
      const languageVoices = voices.filter((voice) => voice.lang.startsWith(selectedLanguage))
      if (languageVoices.length > 0 && !languageVoices.some((voice) => voice.name === selectedVoice)) {
        setSelectedVoice(languageVoices[0].name)
      }
    }
  }, [selectedLanguage, voices, selectedVoice])

  const handlePlay = () => {
    if (synth.current) {
      // Cancel any ongoing speech
      synth.current.cancel()

      // Create a new utterance
      utteranceRef.current = new SpeechSynthesisUtterance(text)

      // Set voice
      const voice = voices.find((v) => v.name === selectedVoice)
      if (voice) {
        utteranceRef.current.voice = voice as SpeechSynthesisVoice
      }

      // Set parameters
      utteranceRef.current.rate = rate
      utteranceRef.current.pitch = pitch
      utteranceRef.current.volume = isMuted ? 0 : volume

      // Add event listeners
      utteranceRef.current.onstart = () => setIsPlaying(true)
      utteranceRef.current.onend = () => setIsPlaying(false)
      utteranceRef.current.onerror = () => setIsPlaying(false)

      // Start speaking
      synth.current.speak(utteranceRef.current)
    }
  }

  const handleStop = () => {
    if (synth.current) {
      synth.current.cancel()
      setIsPlaying(false)
    }
  }

  const startRecording = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }

    // Reset audio chunks
    audioChunksRef.current = []

    // Create audio processing graph for recording
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Create media recorder
        mediaRecorderRef.current = new MediaRecorder(stream)

        // Set up event handlers
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data)
        }

        mediaRecorderRef.current.onstop = () => {
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
          const audioUrl = URL.createObjectURL(audioBlob)

          // Create download link
          const downloadLink = document.createElement("a")
          downloadLink.href = audioUrl
          downloadLink.download = "text-to-speech.wav"
          document.body.appendChild(downloadLink)
          downloadLink.click()
          document.body.removeChild(downloadLink)

          // Clean up
          URL.revokeObjectURL(audioUrl)
          stream.getTracks().forEach((track) => track.stop())
          setIsGenerating(false)
          setShowRecordingAlert(false)

          toast({
            title: "Download Complete",
            description: "Your audio file has been downloaded successfully.",
          })
        }

        // Start recording
        mediaRecorderRef.current.start()
        setShowRecordingAlert(true)

        // Play the speech
        handlePlay()

        // Set a timeout to stop recording after the speech is done
        // We add a buffer of 1 second to make sure we capture everything
        const estimatedDuration = (text.length / 7) * (1 / rate) * 1000 + 2000 // rough estimate based on reading speed
        downloadTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop()
          }
        }, estimatedDuration)
      })
      .catch((err) => {
        console.error("Error accessing microphone:", err)
        setIsGenerating(false)
        toast({
          variant: "destructive",
          title: "Microphone Access Error",
          description: "Please allow microphone access to record audio. You may need to adjust your browser settings.",
        })
      })
  }

  const handleDownload = async () => {
    if (!text) return

    try {
      setIsGenerating(true)

      // We need to request microphone access to record the audio output
      startRecording()
    } catch (error) {
      console.error("Error downloading audio:", error)
      setIsGenerating(false)
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem generating the audio file. Please try again.",
      })
    }
  }

  const toggleMute = () => {
    if (isMuted) {
      setVolume(previousVolume)
      setIsMuted(false)
      if (utteranceRef.current) {
        utteranceRef.current.volume = previousVolume
      }
    } else {
      setPreviousVolume(volume)
      setVolume(0)
      setIsMuted(true)
      if (utteranceRef.current) {
        utteranceRef.current.volume = 0
      }
    }
  }

  const toggleListening = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop()
        setIsListening(false)
      } else {
        recognitionRef.current.start()
        setIsListening(true)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-900 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl"></div>

        {/* Sound wave animation */}
        <div className="absolute top-1/2 left-0 w-full flex justify-center opacity-10">
          <div className="flex items-end space-x-1">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full animate-soundwave"
                style={{
                  height: `${Math.sin(i / 3) * 30 + 40}px`,
                  animationDelay: `${i * 0.05}s`,
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-12 px-4 relative z-10">
        <Card className="w-full max-w-4xl mx-auto bg-white/90 backdrop-blur-sm shadow-xl">
          <CardHeader className="pb-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-t-lg">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Volume2 className="h-6 w-6" />
              Free Text to Speech Converter
            </CardTitle>
            <CardDescription className="text-emerald-100">
              Convert text to speech with over {voices.length} voices in {languageGroups.length} languages
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {showRecordingAlert && (
              <Alert className="bg-amber-50 border-amber-200 mb-4">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Recording in progress</AlertTitle>
                <AlertDescription className="text-amber-700">
                  Please keep this tab open. Your audio is being recorded and will download automatically when complete.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="text-input" className="text-emerald-800 font-medium">
                  Enter your text
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleListening}
                  className={
                    isListening
                      ? "bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700 border-red-300"
                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  }
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {isListening ? "Stop Listening" : "Dictate"}
                </Button>
              </div>
              <Textarea
                id="text-input"
                placeholder="Type or paste your text here..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[150px] border-emerald-200 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="language-select" className="text-emerald-800 font-medium">
                  Language
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger id="language-select" className="border-emerald-200 focus:ring-emerald-500">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {languageGroups.map((group) => (
                      <SelectItem key={group.code} value={group.code}>
                        <div className="flex items-center">
                          <Globe className="h-4 w-4 mr-2 opacity-70" />
                          {group.name} ({group.voices.length})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="voice-select" className="text-emerald-800 font-medium">
                  Voice
                </Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger id="voice-select" className="border-emerald-200 focus:ring-emerald-500">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices
                      .filter((voice) => (selectedLanguage ? voice.lang.startsWith(selectedLanguage) : true))
                      .map((voice) => (
                        <SelectItem key={voice.name} value={voice.name}>
                          {voice.name} {voice.localService ? "(Local)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="controls" className="mt-6">
              <TabsList className="grid w-full grid-cols-2 bg-emerald-50">
                <TabsTrigger
                  value="controls"
                  className="data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                >
                  Controls
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="data-[state=active]:bg-white data-[state=active]:text-emerald-700"
                >
                  Advanced Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="controls" className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={isPlaying ? handleStop : handlePlay}
                      variant="default"
                      disabled={!text || isGenerating}
                      className="w-24 bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="mr-2 h-4 w-4" /> Stop
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" /> Play
                        </>
                      )}
                    </Button>

                    <Button onClick={toggleMute} variant="outline" size="icon" className="border-emerald-200">
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>

                  <Button
                    onClick={handleDownload}
                    variant="outline"
                    disabled={!text || isGenerating || isPlaying}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    {isGenerating ? (
                      <>
                        <span className="animate-pulse mr-2 h-2 w-2 rounded-full bg-emerald-500"></span> Recording...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" /> Download Audio
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="volume-slider" className="text-emerald-800">
                      Volume: {Math.round(volume * 100)}%
                    </Label>
                  </div>
                  <Slider
                    id="volume-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={[volume]}
                    className="[&>span]:bg-emerald-600"
                    onValueChange={(value) => {
                      setVolume(value[0])
                      setIsMuted(value[0] === 0)
                      if (utteranceRef.current) {
                        utteranceRef.current.volume = value[0]
                      }
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="rate-slider" className="text-emerald-800">
                    Speed: {rate.toFixed(1)}x
                  </Label>
                  <Slider
                    id="rate-slider"
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={[rate]}
                    className="[&>span]:bg-emerald-600"
                    onValueChange={(value) => {
                      setRate(value[0])
                      if (utteranceRef.current) {
                        utteranceRef.current.rate = value[0]
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pitch-slider" className="text-emerald-800">
                    Pitch: {pitch.toFixed(1)}
                  </Label>
                  <Slider
                    id="pitch-slider"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={[pitch]}
                    className="[&>span]:bg-emerald-600"
                    onValueChange={(value) => {
                      setPitch(value[0])
                      if (utteranceRef.current) {
                        utteranceRef.current.pitch = value[0]
                      }
                    }}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="flex flex-col items-start pt-0 space-y-2">
            <p className="text-sm text-muted-foreground">
              This application uses the Web Speech API which is available in most modern browsers. Voice availability
              may vary by browser and operating system.
            </p>
            <div className="w-full pt-4 mt-2 border-t border-emerald-100">
              <p className="text-sm text-center">
                Website Development by{" "}
                <a
                  href="https://visernic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                  Visernic Limited
                </a>{" "}
                - visernic.com
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
