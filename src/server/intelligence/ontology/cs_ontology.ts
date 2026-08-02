import type { OntologyConcept } from "../types";


// ─── Ontology Map ──────────────────────────────────────────────────────────────
// Flat Map<id, OntologyConcept>. Ancestors are pre-computed root-first so
// traversal is O(1) — no recursion needed at runtime.
// ──────────────────────────────────────────────────────────────────────────────

const concepts: OntologyConcept[] = [

  // ── Root anchors (not a "domain" — shared ancestors) ────────────────────────
  {
    id: 'ai',
    label: 'Artificial Intelligence',
    aliases: ['AI', 'artificial intelligence'],
    ancestors: ['ai'],
    domain: 'ml',
    relations: [],
  },
  {
    id: 'ml',
    label: 'Machine Learning',
    aliases: ['ML', 'machine learning', 'statistical learning'],
    ancestors: ['ai', 'ml'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'ai' }],
  },
  {
    id: 'deep_learning',
    label: 'Deep Learning',
    aliases: ['DL', 'deep learning', 'deep neural networks', 'DNN'],
    ancestors: ['ai', 'ml', 'deep_learning'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'ml' }],
  },

  // ── ML domain ───────────────────────────────────────────────────────────────
  {
    id: 'supervised_learning',
    label: 'Supervised Learning',
    aliases: ['supervised', 'supervised ML', 'labeled learning'],
    ancestors: ['ai', 'ml', 'supervised_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'unsupervised_learning' },
    ],
  },
  {
    id: 'unsupervised_learning',
    label: 'Unsupervised Learning',
    aliases: ['unsupervised', 'unsupervised ML', 'clustering learning'],
    ancestors: ['ai', 'ml', 'unsupervised_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'supervised_learning' },
    ],
  },
  {
    id: 'reinforcement_learning',
    label: 'Reinforcement Learning',
    aliases: ['RL', 'reinforcement learning', 'reward learning'],
    ancestors: ['ai', 'ml', 'reinforcement_learning'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'ml' }],
  },
  {
    id: 'transfer_learning',
    label: 'Transfer Learning',
    aliases: ['transfer learning', 'domain adaptation', 'fine-tuning'],
    ancestors: ['ai', 'ml', 'transfer_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'few_shot_learning' },
    ],
  },
  {
    id: 'few_shot_learning',
    label: 'Few-Shot Learning',
    aliases: ['few-shot', 'few shot learning', 'low-shot learning', 'N-shot'],
    ancestors: ['ai', 'ml', 'few_shot_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'transfer_learning' },
      { type: 'related_to', target: 'meta_learning' },
    ],
  },
  {
    id: 'semi_supervised_learning',
    label: 'Semi-Supervised Learning',
    aliases: ['semi-supervised', 'semi supervised learning'],
    ancestors: ['ai', 'ml', 'semi_supervised_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'supervised_learning' },
      { type: 'related_to', target: 'unsupervised_learning' },
    ],
  },
  {
    id: 'self_supervised_learning',
    label: 'Self-Supervised Learning',
    aliases: ['self-supervised', 'self supervised', 'SSL'],
    ancestors: ['ai', 'ml', 'self_supervised_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'unsupervised_learning' },
    ],
  },
  {
    id: 'meta_learning',
    label: 'Meta-Learning',
    aliases: ['meta learning', 'learning to learn', 'MAML'],
    ancestors: ['ai', 'ml', 'meta_learning'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'ml' },
      { type: 'related_to', target: 'few_shot_learning' },
    ],
  },

  // ── Deep Learning domain ────────────────────────────────────────────────────
  {
    id: 'neural_network',
    label: 'Neural Network',
    aliases: ['NN', 'neural network', 'artificial neural network', 'ANN', 'perceptron'],
    ancestors: ['ai', 'ml', 'deep_learning', 'neural_network'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'deep_learning' }],
  },
  {
    id: 'cnn',
    label: 'Convolutional Neural Network',
    aliases: ['CNN', 'ConvNet', 'convolutional network', 'conv net', 'conv network'],
    ancestors: ['ai', 'ml', 'deep_learning', 'cnn'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'uses',       target: 'backpropagation' },
      { type: 'uses',       target: 'gradient_descent' },
      { type: 'solves',     target: 'image_classification' },
      { type: 'related_to', target: 'rnn' },
    ],
  },
  {
    id: 'rnn',
    label: 'Recurrent Neural Network',
    aliases: ['RNN', 'recurrent network', 'recurrent neural network'],
    ancestors: ['ai', 'ml', 'deep_learning', 'rnn'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'related_to', target: 'lstm' },
      { type: 'related_to', target: 'gru' },
      { type: 'related_to', target: 'cnn' },
    ],
  },
  {
    id: 'lstm',
    label: 'Long Short-Term Memory',
    aliases: ['LSTM', 'long short term memory', 'long-short term memory'],
    ancestors: ['ai', 'ml', 'deep_learning', 'rnn', 'lstm'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'rnn' },
      { type: 'related_to', target: 'gru' },
      { type: 'solves',     target: 'machine_translation' },
    ],
  },
  {
    id: 'gru',
    label: 'Gated Recurrent Unit',
    aliases: ['GRU', 'gated recurrent unit'],
    ancestors: ['ai', 'ml', 'deep_learning', 'rnn', 'gru'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'rnn' },
      { type: 'related_to', target: 'lstm' },
    ],
  },
  {
    id: 'transformer',
    label: 'Transformer',
    aliases: ['Transformer', 'transformer model', 'transformer architecture', 'attention model'],
    ancestors: ['ai', 'ml', 'deep_learning', 'transformer'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'uses',       target: 'attention' },
      { type: 'solves',     target: 'machine_translation' },
      { type: 'related_to', target: 'bert' },
      { type: 'related_to', target: 'gpt' },
    ],
  },
  {
    id: 'attention',
    label: 'Attention Mechanism',
    aliases: ['attention', 'self-attention', 'multi-head attention', 'cross-attention'],
    ancestors: ['ai', 'ml', 'deep_learning', 'attention'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'part_of',    target: 'transformer' },
    ],
  },
  {
    id: 'bert',
    label: 'BERT',
    aliases: ['BERT', 'Bidirectional Encoder Representations from Transformers', 'bert model'],
    ancestors: ['ai', 'ml', 'deep_learning', 'transformer', 'bert'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'transformer' },
      // FIX (audit #6): trained_on is documented (types.ts) as paper→dataset
      // only ("paper trained_on CIFAR-10"). "BERT trained_on Unsupervised
      // Learning" conflates a training *paradigm* with a training *dataset*
      // and produces a confusing explanation-chain sentence ("Bert is
      // trained on Unsupervised Learning") that reads like a dataset claim
      // but isn't one. This is a training-paradigm relationship, so
      // related_to is the correct relation type here.
      { type: 'related_to', target: 'unsupervised_learning' },
      { type: 'related_to', target: 'gpt' },
    ],
  },
  {
    id: 'gpt',
    label: 'GPT',
    aliases: ['GPT', 'GPT-2', 'GPT-3', 'GPT-4', 'generative pre-trained transformer'],
    ancestors: ['ai', 'ml', 'deep_learning', 'transformer', 'gpt'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'transformer' },
      { type: 'related_to', target: 'bert' },
    ],
  },
  {
    id: 'vae',
    label: 'Variational Autoencoder',
    aliases: ['VAE', 'variational autoencoder', 'variational auto-encoder'],
    ancestors: ['ai', 'ml', 'deep_learning', 'autoencoder', 'vae'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'autoencoder' },
      { type: 'related_to', target: 'gan' },
    ],
  },
  {
    id: 'gan',
    label: 'Generative Adversarial Network',
    aliases: ['GAN', 'generative adversarial network', 'generative adversarial nets'],
    ancestors: ['ai', 'ml', 'deep_learning', 'gan'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'related_to', target: 'vae' },
    ],
  },
  {
    id: 'autoencoder',
    label: 'Autoencoder',
    aliases: ['autoencoder', 'auto-encoder', 'AE'],
    ancestors: ['ai', 'ml', 'deep_learning', 'autoencoder'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'related_to', target: 'vae' },
    ],
  },
  {
    id: 'resnet',
    label: 'ResNet',
    aliases: ['ResNet', 'residual network', 'residual neural network', 'deep residual learning'],
    ancestors: ['ai', 'ml', 'deep_learning', 'cnn', 'resnet'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'cnn' },
      { type: 'solves',     target: 'image_classification' },
      { type: 'related_to', target: 'vgg' },
    ],
  },
  {
    id: 'vgg',
    label: 'VGG',
    aliases: ['VGG', 'VGGNet', 'VGG-16', 'VGG-19', 'very deep convolutional networks'],
    ancestors: ['ai', 'ml', 'deep_learning', 'cnn', 'vgg'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'cnn' },
      { type: 'solves',     target: 'image_classification' },
      { type: 'related_to', target: 'resnet' },
    ],
  },
  {
    id: 'mobilenet',
    label: 'MobileNet',
    aliases: ['MobileNet', 'mobilenetv2', 'mobilenetv3', 'mobile net'],
    ancestors: ['ai', 'ml', 'deep_learning', 'cnn', 'mobilenet'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'cnn' },
      { type: 'solves',     target: 'image_classification' },
      { type: 'related_to', target: 'resnet' },
    ],
  },
  {
    id: 'backpropagation',
    label: 'Backpropagation',
    aliases: ['backprop', 'backpropagation', 'back propagation', 'backward pass'],
    ancestors: ['ai', 'ml', 'deep_learning', 'backpropagation'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'uses',       target: 'gradient_descent' },
    ],
  },
  {
    id: 'dropout',
    label: 'Dropout',
    aliases: ['dropout', 'dropout regularization', 'drop out'],
    ancestors: ['ai', 'ml', 'deep_learning', 'dropout'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'deep_learning' }],
  },
  {
    id: 'batch_norm',
    label: 'Batch Normalization',
    aliases: ['batch norm', 'batch normalization', 'batchnorm'],
    ancestors: ['ai', 'ml', 'deep_learning', 'batch_norm'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'deep_learning' }],
  },
  {
    id: 'activation_fn',
    label: 'Activation Function',
    aliases: ['activation function', 'activation', 'nonlinearity'],
    ancestors: ['ai', 'ml', 'deep_learning', 'activation_fn'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'related_to', target: 'relu' },
      { type: 'related_to', target: 'softmax' },
    ],
  },
  {
    id: 'relu',
    label: 'ReLU',
    aliases: ['ReLU', 'relu', 'rectified linear unit', 'leaky relu', 'leakyrelu'],
    ancestors: ['ai', 'ml', 'deep_learning', 'activation_fn', 'relu'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'activation_fn' }],
  },
  {
    id: 'softmax',
    label: 'Softmax',
    aliases: ['softmax', 'softmax function', 'softmax activation'],
    ancestors: ['ai', 'ml', 'deep_learning', 'activation_fn', 'softmax'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'activation_fn' }],
  },
  {
    id: 'cross_entropy',
    label: 'Cross-Entropy Loss',
    aliases: ['cross entropy', 'cross-entropy loss', 'log loss', 'CE loss'],
    ancestors: ['ai', 'ml', 'deep_learning', 'cross_entropy'],
    domain: 'ml',
    relations: [{ type: 'is_a', target: 'deep_learning' }],
  },
  {
    id: 'gradient_descent',
    label: 'Gradient Descent',
    aliases: ['gradient descent', 'GD', 'stochastic gradient descent', 'SGD', 'mini-batch GD'],
    ancestors: ['ai', 'ml', 'deep_learning', 'gradient_descent'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'deep_learning' },
      { type: 'related_to', target: 'adam' },
      { type: 'related_to', target: 'sgd' },
    ],
  },
  {
    id: 'adam',
    label: 'Adam Optimizer',
    aliases: ['Adam', 'adam optimizer', 'adaptive moment estimation', 'adamw'],
    ancestors: ['ai', 'ml', 'deep_learning', 'gradient_descent', 'adam'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'gradient_descent' },
      { type: 'related_to', target: 'sgd' },
    ],
  },
  {
    id: 'sgd',
    label: 'SGD',
    aliases: ['SGD', 'stochastic gradient descent', 'momentum SGD'],
    ancestors: ['ai', 'ml', 'deep_learning', 'gradient_descent', 'sgd'],
    domain: 'ml',
    relations: [
      { type: 'is_a',       target: 'gradient_descent' },
      { type: 'related_to', target: 'adam' },
    ],
  },

  // ── Computer Vision domain ───────────────────────────────────────────────────
  {
    id: 'computer_vision',
    label: 'Computer Vision',
    aliases: ['CV', 'computer vision', 'image processing', 'visual computing'],
    ancestors: ['ai', 'ml', 'computer_vision'],
    domain: 'computer_vision',
    relations: [{ type: 'is_a', target: 'ml' }],
  },
  {
    id: 'image_classification',
    label: 'Image Classification',
    aliases: ['image classification', 'visual classification', 'image categorization'],
    ancestors: ['ai', 'ml', 'computer_vision', 'image_classification'],
    domain: 'computer_vision',
    relations: [
      { type: 'is_a',       target: 'computer_vision' },
      { type: 'related_to', target: 'object_detection' },
    ],
  },
  {
    id: 'object_detection',
    label: 'Object Detection',
    aliases: ['object detection', 'detection', 'YOLO', 'Faster RCNN', 'SSD'],
    ancestors: ['ai', 'ml', 'computer_vision', 'object_detection'],
    domain: 'computer_vision',
    relations: [
      { type: 'is_a',       target: 'computer_vision' },
      { type: 'related_to', target: 'image_classification' },
      { type: 'related_to', target: 'segmentation' },
    ],
  },
  {
    id: 'segmentation',
    label: 'Image Segmentation',
    aliases: ['segmentation', 'semantic segmentation', 'instance segmentation', 'panoptic segmentation'],
    ancestors: ['ai', 'ml', 'computer_vision', 'segmentation'],
    domain: 'computer_vision',
    relations: [
      { type: 'is_a',       target: 'computer_vision' },
      { type: 'related_to', target: 'object_detection' },
    ],
  },
  {
    id: 'face_recognition',
    label: 'Face Recognition',
    aliases: ['face recognition', 'facial recognition', 'face identification', 'face verification'],
    ancestors: ['ai', 'ml', 'computer_vision', 'face_recognition'],
    domain: 'computer_vision',
    relations: [
      { type: 'is_a',       target: 'computer_vision' },
      { type: 'related_to', target: 'image_classification' },
    ],
  },
  {
    id: 'optical_flow',
    label: 'Optical Flow',
    aliases: ['optical flow', 'motion estimation', 'flow estimation'],
    ancestors: ['ai', 'ml', 'computer_vision', 'optical_flow'],
    domain: 'computer_vision',
    relations: [{ type: 'is_a', target: 'computer_vision' }],
  },
  {
    id: 'depth_estimation',
    label: 'Depth Estimation',
    aliases: ['depth estimation', 'monocular depth', 'stereo depth', '3D reconstruction'],
    ancestors: ['ai', 'ml', 'computer_vision', 'depth_estimation'],
    domain: 'computer_vision',
    relations: [{ type: 'is_a', target: 'computer_vision' }],
  },
  // CV Datasets
  {
    id: 'cifar10',
    label: 'CIFAR-10',
    aliases: ['CIFAR10', 'cifar-10', 'CIFAR 10', 'cifar 10'],
    ancestors: ['dataset', 'cv_dataset', 'cifar10'],
    domain: 'computer_vision',
    relations: [
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'related_to', target: 'cifar100' },
      { type: 'related_to', target: 'imagenet' },
    ],
  },
  {
    id: 'cifar100',
    label: 'CIFAR-100',
    aliases: ['CIFAR100', 'cifar-100', 'CIFAR 100', 'cifar 100'],
    ancestors: ['dataset', 'cv_dataset', 'cifar100'],
    domain: 'computer_vision',
    relations: [
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'related_to', target: 'cifar10' },
      { type: 'related_to', target: 'imagenet' },
    ],
  },
  {
    id: 'imagenet',
    label: 'ImageNet',
    aliases: ['ImageNet', 'ILSVRC', 'imagenet large scale', 'ImageNet-1K', 'ImageNet-21K'],
    ancestors: ['dataset', 'cv_dataset', 'imagenet'],
    domain: 'computer_vision',
    relations: [
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'related_to', target: 'cifar10' },
    ],
  },
  {
    id: 'coco',
    label: 'COCO',
    aliases: ['COCO', 'MS COCO', 'Microsoft COCO', 'common objects in context'],
    ancestors: ['dataset', 'cv_dataset', 'coco'],
    domain: 'computer_vision',
    relations: [
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'related_to', target: 'object_detection' },
    ],
  },
  {
    id: 'voc',
    label: 'PASCAL VOC',
    aliases: ['VOC', 'PASCAL VOC', 'pascal voc', 'VOC2007', 'VOC2012'],
    ancestors: ['dataset', 'cv_dataset', 'voc'],
    domain: 'computer_vision',
    relations: [
      { type: 'part_of',    target: 'computer_vision' },
      { type: 'related_to', target: 'coco' },
    ],
  },

  // ── NLP domain ───────────────────────────────────────────────────────────────
  {
    id: 'nlp',
    label: 'Natural Language Processing',
    aliases: ['NLP', 'natural language processing', 'computational linguistics', 'text processing'],
    ancestors: ['ai', 'ml', 'nlp'],
    domain: 'nlp',
    relations: [{ type: 'is_a', target: 'ml' }],
  },
  {
    id: 'tokenization',
    label: 'Tokenization',
    aliases: ['tokenization', 'tokenizer', 'tokenising', 'BPE', 'byte pair encoding', 'wordpiece'],
    ancestors: ['ai', 'ml', 'nlp', 'tokenization'],
    domain: 'nlp',
    relations: [{ type: 'is_a', target: 'nlp' }],
  },
  {
    id: 'embedding',
    label: 'Word Embedding',
    aliases: ['embedding', 'word embedding', 'word vector', 'token embedding'],
    ancestors: ['ai', 'ml', 'nlp', 'embedding'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'nlp' },
      { type: 'related_to', target: 'word2vec' },
      { type: 'related_to', target: 'glove' },
    ],
  },
  {
    id: 'word2vec',
    label: 'Word2Vec',
    aliases: ['word2vec', 'word 2 vec', 'W2V', 'skip-gram', 'CBOW'],
    ancestors: ['ai', 'ml', 'nlp', 'embedding', 'word2vec'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'embedding' },
      { type: 'related_to', target: 'glove' },
    ],
  },
  {
    id: 'glove',
    label: 'GloVe',
    aliases: ['GloVe', 'glove', 'global vectors for word representation'],
    ancestors: ['ai', 'ml', 'nlp', 'embedding', 'glove'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'embedding' },
      { type: 'related_to', target: 'word2vec' },
    ],
  },
  {
    id: 'sentiment',
    label: 'Sentiment Analysis',
    aliases: ['sentiment analysis', 'opinion mining', 'sentiment classification'],
    ancestors: ['ai', 'ml', 'nlp', 'sentiment'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'nlp' },
      { type: 'related_to', target: 'text_classification' },
    ],
  },
  {
    id: 'ner_task',
    label: 'Named Entity Recognition',
    aliases: ['NER', 'named entity recognition', 'entity extraction', 'entity tagging'],
    ancestors: ['ai', 'ml', 'nlp', 'ner_task'],
    domain: 'nlp',
    relations: [{ type: 'is_a', target: 'nlp' }],
  },
  {
    id: 'machine_translation',
    label: 'Machine Translation',
    aliases: ['machine translation', 'MT', 'neural machine translation', 'NMT', 'seq2seq'],
    ancestors: ['ai', 'ml', 'nlp', 'machine_translation'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'nlp' },
      { type: 'related_to', target: 'question_answering' },
    ],
  },
  {
    id: 'question_answering',
    label: 'Question Answering',
    aliases: ['QA', 'question answering', 'reading comprehension', 'open domain QA'],
    ancestors: ['ai', 'ml', 'nlp', 'question_answering'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'nlp' },
      { type: 'related_to', target: 'machine_translation' },
    ],
  },
  {
    id: 'text_classification',
    label: 'Text Classification',
    aliases: ['text classification', 'document classification', 'text categorization'],
    ancestors: ['ai', 'ml', 'nlp', 'text_classification'],
    domain: 'nlp',
    relations: [
      { type: 'is_a',       target: 'nlp' },
      { type: 'related_to', target: 'sentiment' },
    ],
  },
  {
    id: 'summarization_task',
    label: 'Text Summarization',
    aliases: ['summarization', 'text summarization', 'abstractive summarization', 'extractive summarization'],
    ancestors: ['ai', 'ml', 'nlp', 'summarization_task'],
    domain: 'nlp',
    relations: [{ type: 'is_a', target: 'nlp' }],
  },
  // NLP Benchmarks
  {
    id: 'squad',
    label: 'SQuAD',
    aliases: ['SQuAD', 'squad', 'stanford question answering dataset', 'SQuAD2.0'],
    ancestors: ['dataset', 'nlp_dataset', 'squad'],
    domain: 'nlp',
    relations: [
      { type: 'part_of',    target: 'nlp' },
      { type: 'related_to', target: 'question_answering' },
    ],
  },
  {
    id: 'glue',
    label: 'GLUE Benchmark',
    aliases: ['GLUE', 'SuperGLUE', 'glue benchmark', 'general language understanding evaluation'],
    ancestors: ['dataset', 'nlp_dataset', 'glue'],
    domain: 'nlp',
    relations: [
      { type: 'part_of',    target: 'nlp' },
      { type: 'related_to', target: 'bert' },
    ],
  },

  // ── Systems domain ───────────────────────────────────────────────────────────
  {
    id: 'os',
    label: 'Operating System',
    aliases: ['OS', 'operating system', 'kernel', 'linux', 'unix'],
    ancestors: ['systems', 'os'],
    domain: 'systems',
    relations: [{ type: 'is_a', target: 'systems' }],
  },
  {
    id: 'systems',
    label: 'Computer Systems',
    aliases: ['systems', 'computer systems', 'systems programming'],
    ancestors: ['systems'],
    domain: 'systems',
    relations: [],
  },
  {
    id: 'process',
    label: 'Process',
    aliases: ['process', 'OS process', 'process management', 'fork'],
    ancestors: ['systems', 'os', 'process'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'os' },
      { type: 'related_to', target: 'thread' },
    ],
  },
  {
    id: 'thread',
    label: 'Thread',
    aliases: ['thread', 'multithreading', 'threading', 'pthread'],
    ancestors: ['systems', 'os', 'thread'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'os' },
      { type: 'related_to', target: 'process' },
    ],
  },
  {
    id: 'memory_management',
    label: 'Memory Management',
    aliases: ['memory management', 'heap', 'stack memory', 'garbage collection', 'malloc'],
    ancestors: ['systems', 'os', 'memory_management'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'os' },
      { type: 'related_to', target: 'virtual_memory' },
    ],
  },
  {
    id: 'virtual_memory',
    label: 'Virtual Memory',
    aliases: ['virtual memory', 'paging', 'page table', 'TLB', 'swap'],
    ancestors: ['systems', 'os', 'virtual_memory'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'os' },
      { type: 'related_to', target: 'memory_management' },
    ],
  },
  {
    id: 'cache',
    label: 'CPU Cache',
    aliases: ['cache', 'L1 cache', 'L2 cache', 'L3 cache', 'CPU cache', 'cache memory'],
    ancestors: ['systems', 'os', 'cache'],
    domain: 'systems',
    relations: [{ type: 'is_a', target: 'os' }],
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    aliases: ['scheduler', 'CPU scheduler', 'process scheduler', 'round robin', 'context switch'],
    ancestors: ['systems', 'os', 'scheduler'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'os' },
      { type: 'related_to', target: 'process' },
    ],
  },
  {
    id: 'docker',
    label: 'Docker',
    aliases: ['docker', 'container', 'dockerfile', 'docker image', 'containerization'],
    ancestors: ['systems', 'docker'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'systems' },
      { type: 'related_to', target: 'kubernetes' },
      { type: 'related_to', target: 'microservice' },
    ],
  },
  {
    id: 'kubernetes',
    label: 'Kubernetes',
    aliases: ['kubernetes', 'k8s', 'kubectl', 'container orchestration'],
    ancestors: ['systems', 'kubernetes'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'systems' },
      { type: 'related_to', target: 'docker' },
    ],
  },
  {
    id: 'microservice',
    label: 'Microservices',
    aliases: ['microservices', 'microservice', 'microservice architecture', 'service mesh'],
    ancestors: ['systems', 'distributed_system', 'microservice'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'distributed_system' },
      { type: 'related_to', target: 'docker' },
    ],
  },
  {
    id: 'distributed_system',
    label: 'Distributed System',
    aliases: ['distributed system', 'distributed computing', 'distributed architecture'],
    ancestors: ['systems', 'distributed_system'],
    domain: 'systems',
    relations: [{ type: 'is_a', target: 'systems' }],
  },
  {
    id: 'load_balancer',
    label: 'Load Balancer',
    aliases: ['load balancer', 'load balancing', 'reverse proxy', 'nginx', 'HAProxy'],
    ancestors: ['systems', 'distributed_system', 'load_balancer'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'distributed_system' },
      { type: 'related_to', target: 'microservice' },
    ],
  },
  {
    id: 'message_queue',
    label: 'Message Queue',
    aliases: ['message queue', 'MQ', 'kafka', 'rabbitmq', 'pub/sub', 'event bus'],
    ancestors: ['systems', 'distributed_system', 'message_queue'],
    domain: 'systems',
    relations: [
      { type: 'is_a',       target: 'distributed_system' },
      { type: 'related_to', target: 'microservice' },
    ],
  },

  // ── Algorithms domain ────────────────────────────────────────────────────────
  {
    id: 'algorithms',
    label: 'Algorithms',
    aliases: ['algorithms', 'algorithm', 'data structures', 'DSA'],
    ancestors: ['algorithms'],
    domain: 'algorithms',
    relations: [],
  },
  {
    id: 'sorting',
    label: 'Sorting Algorithms',
    aliases: ['sorting', 'sort', 'quicksort', 'mergesort', 'heapsort', 'bubble sort'],
    ancestors: ['algorithms', 'sorting'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'searching' },
    ],
  },
  {
    id: 'searching',
    label: 'Searching Algorithms',
    aliases: ['searching', 'search', 'binary search', 'linear search', 'search algorithm'],
    ancestors: ['algorithms', 'searching'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'sorting' },
    ],
  },
  {
    id: 'dynamic_programming',
    label: 'Dynamic Programming',
    aliases: ['dynamic programming', 'DP', 'memoization', 'tabulation', 'optimal substructure'],
    ancestors: ['algorithms', 'dynamic_programming'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'divide_conquer' },
      { type: 'related_to', target: 'greedy' },
    ],
  },
  {
    id: 'graph_algorithm',
    label: 'Graph Algorithms',
    aliases: ['graph algorithm', 'graph theory', 'graph traversal'],
    ancestors: ['algorithms', 'graph_algorithm'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'bfs' },
      { type: 'related_to', target: 'dfs' },
    ],
  },
  {
    id: 'bfs',
    label: 'Breadth-First Search',
    aliases: ['BFS', 'breadth first search', 'breadth-first search', 'level order traversal'],
    ancestors: ['algorithms', 'graph_algorithm', 'bfs'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'graph_algorithm' },
      { type: 'related_to', target: 'dfs' },
    ],
  },
  {
    id: 'dfs',
    label: 'Depth-First Search',
    aliases: ['DFS', 'depth first search', 'depth-first search'],
    ancestors: ['algorithms', 'graph_algorithm', 'dfs'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'graph_algorithm' },
      { type: 'related_to', target: 'bfs' },
    ],
  },
  {
    id: 'dijkstra',
    label: "Dijkstra's Algorithm",
    aliases: ["dijkstra", "dijkstra's algorithm", 'shortest path', 'SSSP'],
    ancestors: ['algorithms', 'graph_algorithm', 'dijkstra'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'graph_algorithm' },
      { type: 'related_to', target: 'bfs' },
    ],
  },
  {
    id: 'big_o',
    label: 'Big O Notation',
    aliases: ['big o', 'big-o', 'O(n)', 'time complexity', 'space complexity', 'asymptotic notation'],
    ancestors: ['algorithms', 'big_o'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'complexity' },
    ],
  },
  {
    id: 'complexity',
    label: 'Computational Complexity',
    aliases: ['complexity', 'NP-hard', 'NP-complete', 'P vs NP', 'complexity class'],
    ancestors: ['algorithms', 'complexity'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'big_o' },
    ],
  },
  {
    id: 'recursion',
    label: 'Recursion',
    aliases: ['recursion', 'recursive', 'base case', 'recursive function'],
    ancestors: ['algorithms', 'recursion'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'divide_conquer' },
    ],
  },
  {
    id: 'divide_conquer',
    label: 'Divide and Conquer',
    aliases: ['divide and conquer', 'divide & conquer', 'divide-and-conquer'],
    ancestors: ['algorithms', 'divide_conquer'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'dynamic_programming' },
      { type: 'related_to', target: 'recursion' },
    ],
  },
  {
    id: 'greedy',
    label: 'Greedy Algorithm',
    aliases: ['greedy', 'greedy algorithm', 'greedy approach', 'greedy choice'],
    ancestors: ['algorithms', 'greedy'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a',       target: 'algorithms' },
      { type: 'related_to', target: 'dynamic_programming' },
    ],
  },

  // ── Databases domain ─────────────────────────────────────────────────────────
  {
    id: 'databases',
    label: 'Databases',
    aliases: ['database', 'databases', 'DB', 'data storage', 'DBMS'],
    ancestors: ['databases'],
    domain: 'databases',
    relations: [],
  },
  {
    id: 'sql',
    label: 'SQL',
    aliases: ['SQL', 'structured query language', 'relational database', 'RDBMS', 'postgres', 'mysql'],
    ancestors: ['databases', 'sql'],
    domain: 'databases',
    relations: [
      { type: 'is_a',       target: 'databases' },
      { type: 'related_to', target: 'nosql' },
    ],
  },
  {
    id: 'nosql',
    label: 'NoSQL',
    aliases: ['NoSQL', 'no-sql', 'non-relational', 'mongodb', 'document store', 'key-value store'],
    ancestors: ['databases', 'nosql'],
    domain: 'databases',
    relations: [
      { type: 'is_a',       target: 'databases' },
      { type: 'related_to', target: 'sql' },
    ],
  },
  {
    id: 'indexing',
    label: 'Database Indexing',
    aliases: ['index', 'indexing', 'B-tree index', 'hash index', 'database index'],
    ancestors: ['databases', 'indexing'],
    domain: 'databases',
    relations: [{ type: 'is_a', target: 'databases' }],
  },
  {
    id: 'transaction',
    label: 'Database Transaction',
    aliases: ['transaction', 'ACID', 'atomicity', 'consistency', 'isolation', 'durability'],
    ancestors: ['databases', 'transaction'],
    domain: 'databases',
    relations: [{ type: 'is_a', target: 'databases' }],
  },

  // ── Security domain ──────────────────────────────────────────────────────────
  {
    id: 'security',
    label: 'Cybersecurity',
    aliases: ['security', 'cybersecurity', 'information security', 'infosec', 'network security'],
    ancestors: ['security'],
    domain: 'security',
    relations: [],
  },
  {
    id: 'encryption',
    label: 'Encryption',
    aliases: ['encryption', 'AES', 'RSA', 'cryptography', 'cipher', 'TLS', 'SSL'],
    ancestors: ['security', 'encryption'],
    domain: 'security',
    relations: [{ type: 'is_a', target: 'security' }],
  },
  {
    id: 'authentication_security',
    label: 'Authentication',
    aliases: ['authentication', 'auth', 'OAuth', 'JWT', 'session', 'identity'],
    ancestors: ['security', 'authentication_security'],
    domain: 'security',
    relations: [
      { type: 'is_a',       target: 'security' },
      { type: 'related_to', target: 'encryption' },
    ],
  },
  {
    id: 'networking',
    label: 'Computer Networking',
    aliases: ['networking', 'network', 'TCP/IP', 'HTTP', 'DNS', 'protocol', 'OSI model'],
    ancestors: ['networking'],
    domain: 'networking',
    relations: [],
  },
  {
    id: 'http',
    label: 'HTTP',
    aliases: ['HTTP', 'HTTPS', 'HTTP/2', 'HTTP/3', 'REST', 'RESTful', 'web protocol'],
    ancestors: ['networking', 'http'],
    domain: 'networking',
    relations: [{ type: 'is_a', target: 'networking' }],
  },
  // ── Dataset anchors (referenced by ancestors[] on dataset concepts above) ──
  // FIX (audit #3): these 3 concepts existed ONLY in the deleted compact
  // block below — moved here so they survive the dedup, kept in the
  // file's normal verbose style for consistency.
  {
    id: 'dataset',
    label: 'Dataset',
    aliases: ['dataset', 'benchmark dataset', 'data set'],
    ancestors: ['dataset'],
    domain: 'ml',
    relations: [],
  },
  {
    id: 'cv_dataset',
    label: 'Computer Vision Dataset',
    aliases: ['cv dataset', 'vision dataset', 'image dataset'],
    ancestors: ['dataset', 'cv_dataset'],
    domain: 'computer_vision',
    relations: [
      { type: 'is_a', target: 'dataset' },
      { type: 'part_of', target: 'computer_vision' },
    ],
  },
  {
    id: 'nlp_dataset',
    label: 'NLP Dataset',
    aliases: ['nlp dataset', 'text dataset', 'language dataset'],
    ancestors: ['dataset', 'nlp_dataset'],
    domain: 'nlp',
    relations: [
      { type: 'is_a', target: 'dataset' },
      { type: 'part_of', target: 'nlp' },
    ],
  },


  // ── Software engineering and probabilistic modelling ─────────────────────
  {
    id: 'software_engineering',
    label: 'Software Engineering',
    aliases: ['software engineering', 'software development engineering'],
    ancestors: ['software_engineering'],
    domain: 'software_engineering',
    relations: [],
  },
  {
    id: 'software_quality',
    label: 'Software Quality',
    aliases: ['software quality', 'quality prediction for software'],
    ancestors: ['software_engineering', 'software_quality'],
    domain: 'software_engineering',
    relations: [{ type: 'is_a', target: 'software_engineering' }],
  },
  {
    id: 'software_defect_prediction',
    label: 'Software Defect Prediction',
    aliases: ['software defect prediction', 'defect prediction', 'software quality prediction'],
    ancestors: ['software_engineering', 'software_quality', 'software_defect_prediction'],
    domain: 'software_engineering',
    relations: [
      { type: 'is_a', target: 'software_quality' },
      { type: 'related_to', target: 'residual_defects' },
      { type: 'related_to', target: 'testing_and_rework' },
    ],
  },
  {
    id: 'bayesian_network',
    label: 'Bayesian Network',
    aliases: ['bayesian network', 'Bayesian networks', 'bayesian belief network', 'BN', 'BBN'],
    ancestors: ['algorithms', 'bayesian_network'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a', target: 'algorithms' },
      { type: 'related_to', target: 'causal_modelling' },
      { type: 'solves', target: 'software_defect_prediction' },
    ],
  },
  {
    id: 'dynamic_bayesian_network',
    label: 'Dynamic Bayesian Network',
    aliases: ['dynamic bayesian network', 'dynamic Bayesian networks', 'DBN'],
    ancestors: ['algorithms', 'bayesian_network', 'dynamic_bayesian_network'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a', target: 'bayesian_network' },
      { type: 'related_to', target: 'software_lifecycle' },
    ],
  },
  {
    id: 'causal_modelling',
    label: 'Causal Modelling',
    aliases: ['causal modelling', 'causal modeling', 'causal model', 'causal models'],
    ancestors: ['algorithms', 'causal_modelling'],
    domain: 'algorithms',
    relations: [
      { type: 'is_a', target: 'algorithms' },
      { type: 'related_to', target: 'bayesian_network' },
    ],
  },
  {
    id: 'residual_defects',
    label: 'Residual Defects',
    aliases: ['residual defects', 'remaining defects', 'undetected defects'],
    ancestors: ['software_engineering', 'software_quality', 'residual_defects'],
    domain: 'software_engineering',
    relations: [
      { type: 'is_a', target: 'software_quality' },
      { type: 'related_to', target: 'testing_and_rework' },
    ],
  },
  {
    id: 'software_lifecycle',
    label: 'Software Development Lifecycle',
    aliases: ['software lifecycle', 'software development lifecycle', 'development lifecycle', 'lifecycle phase'],
    ancestors: ['software_engineering', 'software_lifecycle'],
    domain: 'software_engineering',
    relations: [{ type: 'is_a', target: 'software_engineering' }],
  },
  {
    id: 'testing_and_rework',
    label: 'Testing and Rework',
    aliases: ['testing and rework', 'testing process quality', 'rework process'],
    ancestors: ['software_engineering', 'testing_and_rework'],
    domain: 'software_engineering',
    relations: [
      { type: 'is_a', target: 'software_engineering' },
      { type: 'influences', target: 'residual_defects' },
    ],
  },
  {
    id: 'quality_indicators',
    label: 'Quality Indicators',
    aliases: ['quality indicators', 'process quality indicators', 'indicator variables'],
    ancestors: ['software_engineering', 'software_quality', 'quality_indicators'],
    domain: 'software_engineering',
    relations: [{ type: 'is_a', target: 'software_quality' }],
  },
  {
    id: 'decision_support_system',
    label: 'Decision Support System',
    aliases: ['decision support system', 'decision support tool'],
    ancestors: ['systems', 'decision_support_system'],
    domain: 'systems',
    relations: [{ type: 'is_a', target: 'systems' }],
  },
  {
    id: 'agenarisk',
    label: 'AgenaRisk',
    aliases: ['AgenaRisk', 'AgenaRisk toolset'],
    ancestors: ['systems', 'decision_support_system', 'agenarisk'],
    domain: 'systems',
    relations: [
      { type: 'is_a', target: 'decision_support_system' },
      { type: 'uses', target: 'bayesian_network' },
    ],
  },

];


// ─── Exported Map ──────────────────────────────────────────────────────────────
// Build once at module load — O(n) — then every lookup is O(1).

export const ONTOLOGY_MAP: Map<string, OntologyConcept> = new Map(
  concepts.map((c) => [c.id, c]),
);

export default ONTOLOGY_MAP;