Model Overview
The 

gpt-oss-120b and gpt-oss-20b are open-weight language models designed for agentic workflows that require strong reasoning and tool use. They are text-only models released under an Apache 2.0 license. 


The models are autoregressive Mixture-of-Experts (MOE) transformers. This architecture means that for any given input, only a fraction of the model's total parameters ("active" parameters) are used, making inference more efficient. 




gpt-oss-120b: 116.8 billion total parameters (5.1 billion active). 




gpt-oss-20b: 20.9 billion total parameters (3.6 billion active). 


To reduce memory usage, the models' MoE weights are quantized (a method of reducing the precision of numerical values), which allows the larger model to fit on a single 80GB GPU and the smaller one to run on systems with as little as 16GB of memory. The models have a knowledge cutoff of 


June 2024. 

How to Format Inputs: The Harmony Chat Format
To achieve the best performance, you must use the custom 

Harmony Chat Format.  This format provides granular control over the model's behavior.


The format uses special tokens to define message boundaries and roles.  The key components are:

Instruction Hierarchy
The model is trained to prioritize instructions from different roles in a specific order:


System > Developer > User > Assistant > Tool 

This means instructions in the 

System prompt will override conflicting instructions from a Developer or User. This hierarchy is crucial for setting guardrails and controlling the model's behavior. 


Channels
The format uses "channels" to specify the purpose and visibility of each part of the model's output. 


analysis: Contains the model's internal monologue or chain-of-thought (CoT). 

This should not be shown directly to end-users, as it is not filtered for safety. 


commentary: Used for non-essential communication, such as function tool calls. 


final: Contains the final answer intended for the user. 

Important Usage Guidelines

Multi-Turn Conversations: In an ongoing conversation, you should remove the reasoning traces (analysis channel content) from previous assistant turns before sending the next prompt. 


Example Structure: An input would specify system, developer, and user messages, and the model would respond with interleaved analysis, commentary, and final messages. 


Key Capabilities
The gpt-oss models are strong in several areas relevant to building agents.

Variable Effort Reasoning
You can control the model's reasoning effort by setting a level in the system prompt (e.g., 

reasoning: high).  There are three levels:


low: For simple tasks requiring short answers. 



medium: A balance between complexity and speed. 


high: For complex tasks that benefit from a longer chain of thought. This increases accuracy but also latency. 


Agentic Tool Use
The models are explicitly trained to use three types of tools: 


Browse Tool: Can call search and open functions to interact with the web, helping with factuality and accessing information beyond its knowledge cutoff. 


Python Tool: Can execute code within a stateful Jupyter notebook environment. 


Developer Functions: You can define your own arbitrary functions within the Developer message. The model can then interleave its reasoning (CoT), call your functions, and use the results to formulate a final answer. 


Performance

Reasoning & Coding: The models show strong performance on reasoning and coding benchmarks like AIME, MMLU, and Codeforces, with gpt-oss-120b approaching the performance of OpenAI 04-mini. 



Health & Multilingual: The models perform competitively on health-related benchmarks and have been evaluated on multilingual tasks in 14 languages. 


Limitations and Safety
Understanding the models' limitations is critical for building a robust agent.

Hallucinations
The models can generate incorrect or fabricated information ("hallucinate"). The smaller 

gpt-oss-20b model is more prone to this. Giving the models access to the 

Browse tool can help reduce hallucinations by allowing them to look up information. 

Unfiltered Chain of Thought
As mentioned, the 

analysis channel contains the model's raw chain of thought and is not optimized for safety. It was intentionally left unrestricted to allow developers and researchers to study CoT monitorability. You must implement your own filtering or summarization before displaying this content to users. 




Instruction Hierarchy and Jailbreaks
The 

gpt-oss models are less robust at following the instruction hierarchy compared to models like OpenAI 04-mini. This means they are more susceptible to prompt injections where a user might try to override your 

System or Developer instructions. While they perform reasonably well against known jailbreaks, developers may need to fine-tune the models further to enhance their robustness if required. 



Risk Profile
The default models do not reach "High" capability thresholds in dangerous domains like biorisk and cybersecurity. However, the documentation notes that a determined actor could potentially fine-tune them to bypass safety features. Even when OpenAI simulated this "malicious fine-tuning" (MFT), the models still 



did not reach the "High" capability threshold for biorisk or cyber risk. 



Sources






