#!/usr/bin/env python3
"""Dev-only: writes /assets/data/knowledge.<lang>.json (PUBLIC info only).
Run: python3 tools/knowledge-src.py"""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'data'

K = {
 'es-AR': {
  'greeting': '¡Hola! Soy el Agente de AgentiCuántico. Preguntame qué hacemos, cómo funciona, precios o cómo contactarnos.',
  'fallback': 'No tengo esa respuesta en mi base pública. Para algo específico escribinos a agenticuantico@gmail.com con el asunto Consulta Comercial y te respondemos.',
  'suggestions': ['¿Qué es AgentiCuántico?', '¿Cómo funciona?', '¿Cuánto cuesta?', '¿Es seguro con mis datos?', 'Soy inversor', '¿Cómo los contacto?'],
  'intents': [
   ('greet', ['hola', 'buenas', 'buen dia', 'buenas tardes', 'que tal', 'hey'], 'Hola, ¿cómo estás? Soy el Agente de AgentiCuántico. Contame qué te interesa: qué hacemos, casos de uso, precios o inversión.', 0.8),
   ('what', ['que es', 'que hace', 'agenticuantico', 'plataforma', 'servicio', 'producto', 'que hacen'], 'AgentiCuántico es una plataforma de inteligencia artificial agentic hecha en Argentina. Agentes autónomos entienden un objetivo, lo dividen en pasos, se reparten el trabajo y responden con voz y avatar, con la privacidad resuelta desde la arquitectura.', 1),
   ('how', ['como funciona', 'funcionamiento', 'pipeline', 'proceso', 'pasos', 'orquestacion', 'orquestador'], 'Funciona en un pipeline agentic: recibe la señal, comprende la intención, planifica evaluando alternativas en paralelo, orquesta agentes especialistas, actúa con herramientas autorizadas y verifica antes de responder.', 1),
   ('quantum', ['cuantico', 'cuantica', 'computadora cuantica', 'qubit', 'superposicion'], 'Lo cuántico es un enfoque inspirado en la superposición: el cerebro explora varias hipótesis a la vez y converge en la mejor. Es una metáfora de diseño; funciona en infraestructura convencional, sin hardware cuántico.', 1),
   ('privacy', ['privacidad', 'datos', 'seguro', 'seguridad', 'ley 25326', 'proteccion', 'confidencial'], 'La privacidad está en la arquitectura: el cerebro privado vive separado de la web pública, las claves nunca llegan al navegador y tratamos datos según la Ley 25.326. Esta demo funciona en tu navegador y no envía tus preguntas a servidores.', 1),
   ('avatar', ['avatar', 'voz', 'labios', 'manos', 'hablar', 'habla', '3d', 'gestos'], 'Soy un avatar 3D creado en tiempo real. Hablo con la voz de tu navegador, muevo los labios según los sonidos de cada palabra y gesticulo con las manos mientras explico.', 1),
   ('langs', ['idioma', 'idiomas', 'ingles', 'portugues', 'espanol', 'lenguaje'], 'Hablo español rioplatense, inglés y portugués de Brasil. Podés cambiar el idioma con las banderas de arriba y mi voz cambia con él.', 1),
   ('pricing', ['precio', 'precios', 'cuanto cuesta', 'costo', 'plan', 'planes', 'suscripcion', 'pro', 'gratis'], 'Hay tres planes mensuales: Gratis, Pro por {pro_usd} dólares ({pro_ars} pesos) y Empresa por {empresa_usd} dólares ({empresa_ars} pesos). Podés ver el detalle en la sección Precios.', 1),
   ('payments', ['pagar', 'pago', 'mercado pago', 'paypal', 'tarjeta', 'cobro', 'cancelar'], 'Podés pagar en pesos con Mercado Pago o en dólares con PayPal. La suscripción se renueva cada mes y la cancelás cuando quieras.', 1),
   ('cases', ['casos', 'caso de uso', 'empresa', 'negocio', 'pyme', 'atencion', 'ventas', 'clientes', 'industria'], 'Algunos casos: atención al cliente 24/7, ventas y calificación de leads, back-office, conocimiento interno, reportes en lenguaje natural y asistentes para industria, energía y logística.', 1),
   ('custom', ['a medida', 'personalizado', 'mi empresa', 'integracion', 'integraciones', 'conocimiento propio'], 'Sí, podemos armar agentes con el conocimiento y las integraciones de tu empresa. Es el foco del plan Empresa. Escribinos y preparamos una propuesta.', 1),
   ('investors', ['inversor', 'inversores', 'invertir', 'inversion', 'socio', 'financiamiento', 'roadmap', 'hoja de ruta'], 'Buscamos socios que compartan la visión de una IA útil y privada para Latinoamérica. Estamos en la etapa de fundaciones y el próximo paso son pilotos con empresas. Escribinos a agenticuantico@gmail.com con el asunto Consulta Comercial y te compartimos la presentación.', 1),
   ('contact', ['contacto', 'contactar', 'email', 'mail', 'correo', 'escribir', 'hablar con alguien', 'comercial'], 'Escribinos a agenticuantico@gmail.com con el asunto Consulta Comercial, o tocá el botón Consulta comercial de esta página.', 1),
   ('app', ['app', 'aplicacion', 'instalar', 'celular', 'android', 'descargar', 'probar'], 'Podés probar la app web en agenticuantico.dev.ar/app. En Chrome para Android, abrí el menú y elegí Instalar app para tenerla en tu pantalla de inicio.', 1),
   ('where', ['donde', 'argentina', 'pais', 'ubicacion', 'quienes son'], 'AgentiCuántico es un proyecto nacido en Argentina, con foco en Latinoamérica y en clientes de habla hispana y portuguesa.', 0.9),
   ('thanks', ['gracias', 'genial', 'buenisimo', 'perfecto', 'chau'], '¡Gracias a vos! Si querés avanzar, escribinos con el asunto Consulta Comercial. Fue un gusto charlar.', 0.8),
  ]
 },
 'en': {
  'greeting': "Hi! I'm the AgentiCuántico Agent. Ask me what we do, how it works, pricing or how to reach us.",
  'fallback': "I don't have that answer in my public knowledge base. For anything specific, email agenticuantico@gmail.com with the subject Consulta Comercial and we'll get back to you.",
  'suggestions': ['What is AgentiCuántico?', 'How does it work?', 'How much does it cost?', 'Is my data safe?', "I'm an investor", 'How can I contact you?'],
  'intents': [
   ('greet', ['hello', 'hi', 'hey', 'good morning', 'good afternoon'], "Hello! I'm the AgentiCuántico Agent. Tell me what you're interested in: what we do, use cases, pricing or investing.", 0.8),
   ('what', ['what is', 'what does', 'agenticuantico', 'platform', 'service', 'product', 'what do you do'], 'AgentiCuántico is an agentic artificial intelligence platform made in Argentina. Autonomous agents understand a goal, break it into steps, share the work and respond with voice and an avatar, with privacy built into the architecture.', 1),
   ('how', ['how does it work', 'how it works', 'pipeline', 'process', 'steps', 'orchestration', 'orchestrator'], 'It works as an agentic pipeline: it receives the signal, understands the intent, plans by evaluating alternatives in parallel, orchestrates specialist agents, acts with authorized tools and verifies before answering.', 1),
   ('quantum', ['quantum', 'quantum computer', 'qubit', 'superposition'], 'Quantum here means an approach inspired by superposition: the brain explores several hypotheses at once and converges on the best one. It is a design metaphor; it runs on conventional infrastructure, with no quantum hardware.', 1),
   ('privacy', ['privacy', 'data', 'safe', 'secure', 'security', 'protection', 'confidential'], 'Privacy is in the architecture: the private brain lives apart from the public website, keys never reach the browser, and data is handled under Argentina\'s Law 25,326. This demo runs in your browser and does not send your questions to servers.', 1),
   ('avatar', ['avatar', 'voice', 'lips', 'hands', 'speak', 'talk', '3d', 'gestures'], "I'm a 3D avatar rendered in real time. I speak with your browser's voice, move my lips to the sounds of each word and gesture with my hands as I explain.", 1),
   ('langs', ['language', 'languages', 'english', 'portuguese', 'spanish'], 'I speak Rioplatense Spanish, English and Brazilian Portuguese. Switch languages with the flags at the top and my voice switches too.', 1),
   ('pricing', ['price', 'prices', 'pricing', 'how much', 'cost', 'plan', 'plans', 'subscription', 'pro', 'free'], 'There are three monthly plans: Gratis (free), Pro for {pro_usd} US dollars ({pro_ars} Argentine pesos) and Empresa (business) for {empresa_usd} US dollars ({empresa_ars} pesos). See the Pricing section for details.', 1),
   ('payments', ['pay', 'payment', 'mercado pago', 'paypal', 'card', 'billing', 'cancel'], 'You can pay in Argentine pesos with Mercado Pago or in US dollars with PayPal. The subscription renews monthly and you can cancel anytime.', 1),
   ('cases', ['use case', 'use cases', 'company', 'business', 'customer service', 'sales', 'customers', 'industry'], 'Some use cases: 24/7 customer service, sales and lead qualification, back office, internal knowledge, natural-language reporting, and assistants for industry, energy and logistics.', 1),
   ('custom', ['custom', 'tailored', 'my company', 'integration', 'integrations', 'own knowledge'], "Yes, we can build agents with your company's knowledge and integrations. That's the focus of the Empresa plan. Write to us and we'll prepare a proposal.", 1),
   ('investors', ['investor', 'investors', 'invest', 'investment', 'partner', 'funding', 'roadmap'], "We're looking for partners who share the vision of useful, private AI for Latin America. We're in the foundations stage and the next step is pilots with companies. Email agenticuantico@gmail.com with the subject Consulta Comercial and we'll share our deck.", 1),
   ('contact', ['contact', 'email', 'mail', 'reach', 'talk to someone', 'sales team'], 'Email agenticuantico@gmail.com with the subject Consulta Comercial, or tap the Business inquiry button on this page.', 1),
   ('app', ['app', 'application', 'install', 'phone', 'android', 'download', 'try'], 'You can try the web app at agenticuantico.dev.ar/app. In Chrome on Android, open the menu and choose Install app to add it to your home screen.', 1),
   ('where', ['where', 'argentina', 'country', 'location', 'who are you'], 'AgentiCuántico is a project born in Argentina, focused on Latin America and on Spanish- and Portuguese-speaking customers.', 0.9),
   ('thanks', ['thanks', 'thank you', 'great', 'perfect', 'bye'], "Thank you! If you'd like to move forward, email us with the subject Consulta Comercial. It was a pleasure chatting.", 0.8),
  ]
 },
 'pt-BR': {
  'greeting': 'Olá! Eu sou o Agente da AgentiCuántico. Pergunte o que fazemos, como funciona, preços ou como falar com a gente.',
  'fallback': 'Não tenho essa resposta na minha base pública. Para algo específico, escreva para agenticuantico@gmail.com com o assunto Consulta Comercial e responderemos.',
  'suggestions': ['O que é a AgentiCuántico?', 'Como funciona?', 'Quanto custa?', 'Meus dados estão seguros?', 'Sou investidor', 'Como entro em contato?'],
  'intents': [
   ('greet', ['ola', 'oi', 'bom dia', 'boa tarde', 'tudo bem'], 'Olá! Eu sou o Agente da AgentiCuántico. Conte o que te interessa: o que fazemos, casos de uso, preços ou investimento.', 0.8),
   ('what', ['o que e', 'o que faz', 'agenticuantico', 'plataforma', 'servico', 'produto', 'o que voces fazem'], 'A AgentiCuántico é uma plataforma de inteligência artificial agentic feita na Argentina. Agentes autônomos entendem um objetivo, dividem em etapas, repartem o trabalho e respondem com voz e avatar, com a privacidade resolvida na arquitetura.', 1),
   ('how', ['como funciona', 'funcionamento', 'pipeline', 'processo', 'etapas', 'orquestracao', 'orquestrador'], 'Funciona em um pipeline agentic: recebe o sinal, compreende a intenção, planeja avaliando alternativas em paralelo, orquestra agentes especialistas, age com ferramentas autorizadas e verifica antes de responder.', 1),
   ('quantum', ['quantico', 'quantica', 'computador quantico', 'qubit', 'superposicao'], 'O quântico é uma abordagem inspirada na superposição: o cérebro explora várias hipóteses ao mesmo tempo e converge para a melhor. É uma metáfora de design; funciona em infraestrutura convencional, sem hardware quântico.', 1),
   ('privacy', ['privacidade', 'dados', 'seguro', 'seguranca', 'protecao', 'confidencial'], 'A privacidade está na arquitetura: o cérebro privado fica separado do site público, as chaves nunca chegam ao navegador e tratamos os dados conforme a Lei 25.326 da Argentina. Esta demo roda no seu navegador e não envia suas perguntas a servidores.', 1),
   ('avatar', ['avatar', 'voz', 'labios', 'maos', 'falar', 'fala', '3d', 'gestos'], 'Sou um avatar 3D criado em tempo real. Falo com a voz do seu navegador, movo os lábios conforme os sons de cada palavra e gesticulo com as mãos enquanto explico.', 1),
   ('langs', ['idioma', 'idiomas', 'ingles', 'portugues', 'espanhol', 'lingua'], 'Falo espanhol rioplatense, inglês e português do Brasil. Troque o idioma pelas bandeiras no topo e minha voz muda junto.', 1),
   ('pricing', ['preco', 'precos', 'quanto custa', 'custo', 'plano', 'planos', 'assinatura', 'pro', 'gratis'], 'São três planos mensais: Grátis, Pro por {pro_usd} dólares ({pro_ars} pesos argentinos) e Empresa por {empresa_usd} dólares ({empresa_ars} pesos). Veja os detalhes na seção Preços.', 1),
   ('payments', ['pagar', 'pagamento', 'mercado pago', 'paypal', 'cartao', 'cobranca', 'cancelar'], 'Você pode pagar em pesos argentinos com Mercado Pago ou em dólares com PayPal. A assinatura renova todo mês e você cancela quando quiser.', 1),
   ('cases', ['casos', 'caso de uso', 'empresa', 'negocio', 'atendimento', 'vendas', 'clientes', 'industria'], 'Alguns casos: atendimento ao cliente 24/7, vendas e qualificação de leads, back-office, conhecimento interno, relatórios em linguagem natural e assistentes para indústria, energia e logística.', 1),
   ('custom', ['sob medida', 'personalizado', 'minha empresa', 'integracao', 'integracoes', 'conhecimento proprio'], 'Sim, podemos montar agentes com o conhecimento e as integrações da sua empresa. É o foco do plano Empresa. Escreva para nós e preparamos uma proposta.', 1),
   ('investors', ['investidor', 'investidores', 'investir', 'investimento', 'socio', 'parceiro', 'financiamento', 'roteiro'], 'Buscamos parceiros que compartilhem a visão de uma IA útil e privada para a América Latina. Estamos na etapa de fundações e o próximo passo são pilotos com empresas. Escreva para agenticuantico@gmail.com com o assunto Consulta Comercial e compartilhamos a apresentação.', 1),
   ('contact', ['contato', 'contatar', 'email', 'e mail', 'correio', 'escrever', 'falar com alguem', 'comercial'], 'Escreva para agenticuantico@gmail.com com o assunto Consulta Comercial, ou toque no botão Consulta comercial desta página.', 1),
   ('app', ['app', 'aplicativo', 'instalar', 'celular', 'android', 'baixar', 'experimentar'], 'Você pode experimentar o app web em agenticuantico.dev.ar/app. No Chrome para Android, abra o menu e escolha Instalar app para tê-lo na tela inicial.', 1),
   ('where', ['onde', 'argentina', 'pais', 'localizacao', 'quem sao'], 'A AgentiCuántico é um projeto nascido na Argentina, com foco na América Latina e em clientes de língua espanhola e portuguesa.', 0.9),
   ('thanks', ['obrigado', 'obrigada', 'otimo', 'perfeito', 'tchau'], 'Obrigado a você! Se quiser avançar, escreva com o assunto Consulta Comercial. Foi um prazer conversar.', 0.8),
  ]
 }
}

OUT.mkdir(parents=True, exist_ok=True)
for lang, kb in K.items():
    data = {
        'lang': lang, 'version': 1,
        'greeting': kb['greeting'], 'fallback': kb['fallback'], 'suggestions': kb['suggestions'],
        'intents': [{'id': i, 'keywords': kw, 'answer': a, 'weight': w} for i, kw, a, w in kb['intents']]
    }
    (OUT / f'knowledge.{lang}.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
print('ok')
