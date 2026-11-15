import Foundation
import Capacitor
import Vision
import UIKit

@objc(ReceiptOcrPlugin)
public class ReceiptOcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ReceiptOcrPlugin"
    public let jsName = "ReceiptOcr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognizeText", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognizeText(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64") else {
            call.reject("Missing base64 image data")
            return
        }

        let cleanBase64 = base64.replacingOccurrences(
            of: "^data:image/[a-zA-Z]+;base64,",
            with: "",
            options: .regularExpression
        )

        guard let imageData = Data(base64Encoded: cleanBase64, options: .ignoreUnknownCharacters),
              let uiImage = UIImage(data: imageData),
              let cgImage = uiImage.cgImage else {
            call.reject("Invalid image data")
            return
        }

        let orientation = cgImageOrientation(from: uiImage.imageOrientation)

        DispatchQueue.global(qos: .userInitiated).async {
            let request = VNRecognizeTextRequest { request, error in
                if let error = error {
                    call.reject("Vision OCR failed: \(error.localizedDescription)")
                    return
                }

                guard let observations = request.results as? [VNRecognizedTextObservation] else {
                    call.resolve(["text": ""])
                    return
                }

                // Group observations into visual horizontal rows (Vision y=0 is bottom, y=1 is top)
                struct TextBlock {
                    let text: String
                    let minX: CGFloat
                    let midY: CGFloat
                    let height: CGFloat
                }

                let blocks: [TextBlock] = observations.compactMap { obs in
                    guard let top = obs.topCandidates(1).first else { return nil }
                    let box = obs.boundingBox
                    return TextBlock(
                        text: top.string,
                        minX: box.minX,
                        midY: box.midY,
                        height: box.height
                    )
                }

                // Sort top-to-bottom (descending midY)
                let sorted = blocks.sorted { $0.midY > $1.midY }
                var rows: [[TextBlock]] = []

                for block in sorted {
                    let tolerance = max(block.height * 0.65, 0.012)
                    if let lastIdx = rows.indices.last,
                       let firstInRow = rows[lastIdx].first,
                       abs(firstInRow.midY - block.midY) <= tolerance {
                        rows[lastIdx].append(block)
                    } else {
                        rows.append([block])
                    }
                }

                let lines = rows.map { row in
                    row.sorted { $0.minX < $1.minX }
                        .map { $0.text }
                        .joined(separator: " ")
                }

                call.resolve(["text": lines.joined(separator: "\n")])
            }

            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
            do {
                try handler.perform([request])
            } catch {
                call.reject("Vision handler error: \(error.localizedDescription)")
            }
        }
    }

    private func cgImageOrientation(from orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch orientation {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}
