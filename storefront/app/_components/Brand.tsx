import Image from 'next/image'

export default function Brand() {
  return (
    <span className="ua-brand">
      <Image src="/unityalgo.png" alt="UnityAlgo" width={42} height={42} />
      <span>
        <strong>UnityAffliate</strong>
        <small>Powered by UnityAlgo</small>
      </span>
    </span>
  )
}
