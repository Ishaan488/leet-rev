let utterance; // global variable to control speech
import 'dotenv/config';
configDotenv.config()

// Get active tab
function getActiveTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        callback(tabs[0].id);
    });
}

// Start reading page text
document.getElementById("startRead").addEventListener("click", () => {
    getActiveTab((tabId) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => document.body.innerText
        }, (results) => {
            if (results && results[0] && results[0].result) {
                const text = results[0].result;
                utterance = new SpeechSynthesisUtterance(text);
                speechSynthesis.speak(utterance);
            }
        });
    });
});

// Stop reading
document.getElementById("stopRead").addEventListener("click", () => {
    if (utterance) {
        speechSynthesis.cancel();
        utterance = null;
    }
});

// Highlight page
document.getElementById("highlightText").addEventListener("click", () => {
    getActiveTab((tabId) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const el = document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0];
                if (!el) return;
                if (el.__blinkInterval) {
                    // stop blinking
                    clearInterval(el.__blinkInterval);
                    el.__blinkInterval = null;
                    el.style.border = "";
                    el.style.borderColor = "";
                } else {
                    // start blinking
                    el.style.border = "3px dashed orange";
                    el.style.borderRadius = "10px";
                    el.style.borderColor = "transparent";
                    el.style.transition = "border-color 800ms ease-in-out";
                    el.__blinkInterval = setInterval(() => {
                        el.style.borderColor = (el.style.borderColor === "transparent" || el.style.borderColor === "") ? "orange" : "transparent";
                    }, 1000);
                }
            }
            //   document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0].children[0].style.backgroundColor="rgba(255, 161, 53, 0.72)";
        });
    });
});

let title = "";
let problem = "";
let solution = "";
function putInExtCodebox(solution) {
    let codebox = document.getElementById("code");
    codebox.innerText = `${solution}`;
}
function putInExtNotebox(note) {
    let notebox = document.getElementById("note");
    notebox.value = `${note}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("generateNote");
    const showCodeButton = document.getElementById("showCode");
    if (button) {
        button.addEventListener("click", () => {
            getActiveTab((tabId) => {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        title = document.getElementsByClassName("text-title-large")[0].textContent;
                        problem = document.getElementsByClassName("elfjS")[0].textContent;
                        solution = document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0].innerText;
                        chrome.runtime.sendMessage({ action: 'sendToGemini', title: title, problem: problem, solution: solution });
                    }
                    //   document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0].children[0].style.backgroundColor="rgba(255, 161, 53, 0.72)";
                });
            });
        });
    }
    else {
        console.error("Generate Note button not found!");
    }
    showCodeButton.addEventListener("click", () => {
        getActiveTab((tabId) => {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    solution = document.getElementsByClassName("view-lines monaco-mouse-cursor-text")[0].innerText;
                    chrome.runtime.sendMessage({ action: 'putCode', solution: solution });
                }
            });
        });
    });
});

chrome.runtime.onMessage.addListener((message) => {
    if(message.action === 'putCode') {
        putInExtCodebox(message.solution);
    }
    if (message.action === 'sendToGemini') {
        putInExtCodebox(message.solution);
        main(message.title, message.problem, message.solution)
            .then(response => {
                const text = response.candidates[0].content.parts[0].text;
                const parsed = JSON.parse(text);
                putInExtNotebox(parsed.note);
            })
            .catch(error => {
                console.error('Error in API response:', error);
            });
    }
});

//--- GeminiAPI ---


import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main(title, problem, solution) {
    try {
        putInExtNotebox("Making API call... Please wait.");
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `problemTitle: ${title} \n${problem}\n My Solution: \n${solution}\n I have given you the problem and my solution. 
      Please generate a summary of my solution, telling its approach, key steps, its time and space complexity.
      This is for my personal understanding, so be concise and precise.
      and the purpose of this is to revise my solution later quickly.
      so make it in structured way.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: 'object',
                    properties: {
                        problemTitle: {type: 'string'},
                        solution: { type: 'string' },
                        note: { type: 'string' },
                    },
                    propertyOrdering: ["problemTitle", "solution", "note"]
                }
            }
        });
        putInExtNotebox("Received response from API. Returning data...");
        return response; // Return the response for further use
    } catch (error) {
        console.error('Error generating content:', error);
        throw error; // Ensure errors are propagated
    }
}