import { MnistData } from './data.js';

var updater = document.getElementById("updater");
var global_model;

async function run() {
    const data = new MnistData();

    updater.textContent = "Loading Data";
    await data.load();

    const model = getModel();
    //tfvis.show.modelSummary({ name: 'Model Architecture' }, model);
    global_model = model;

    updater.textContent = "Model Training";
    await train(model, data);
    updater.textContent = "Model Done Training";

    await showAccuracy(model, data);

    document.getElementById("canvas-block").style.display = "block";
}

document.addEventListener('DOMContentLoaded', run);



function getModel() {
    const model = tf.sequential();

    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const IMAGE_CHANNELS = 1;

    // In the first layer of our convolutional neural network we have 
    // to specify the input shape. Then we specify some parameters for 
    // the convolution operation that takes place in this layer.
    model.add(tf.layers.conv2d({
        inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
        kernelSize: 5,
        filters: 8,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
    }));

    // The MaxPooling layer acts as a sort of downsampling using max values
    // in a region instead of averaging.  
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

    // Repeat another conv2d + maxPooling stack. 
    // Note that we have more filters in the convolution.
    model.add(tf.layers.conv2d({
        kernelSize: 5,
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
    }));
    model.add(tf.layers.maxPooling2d({ poolSize: [2, 2], strides: [2, 2] }));

    // Now we flatten the output from the 2D filters into a 1D vector to prepare
    // it for input into our last layer. This is common practice when feeding
    // higher dimensional data to a final classification output layer.
    model.add(tf.layers.flatten());

    // Our last layer is a dense layer which has 10 output units, one for each
    // output class (i.e. 0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
    const NUM_OUTPUT_CLASSES = 10;
    model.add(tf.layers.dense({
        units: NUM_OUTPUT_CLASSES,
        kernelInitializer: 'varianceScaling',
        activation: 'softmax'
    }));


    // Choose an optimizer, loss function and accuracy metric,
    // then compile and return the model
    const optimizer = tf.train.adam();
    model.compile({
        optimizer: optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
    });

    return model;
}

async function train(model, data) {
    const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
    const container = {
        name: 'Model Training', styles: { height: '1000px' }
    };
    //const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);

    const BATCH_SIZE = 512;
    const TRAIN_DATA_SIZE = 5500;
    const TEST_DATA_SIZE = 1000;

    //Getting training data 
    const [trainXs, trainYs] = tf.tidy(() => {
        const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
        return [
            d.xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    //Getting testing data 
    const [testXs, testYs] = tf.tidy(() => {
        const d = data.nextTestBatch(TEST_DATA_SIZE);
        return [
            d.xs.reshape([TEST_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    return model.fit(trainXs, trainYs, {
        batchSize: BATCH_SIZE,
        validationData: [testXs, testYs],
        epochs: 10,
        shuffle: true
        //callbacks: fitCallbacks
    });
}

const classNames = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

function doPrediction(model, data, testDataSize = 500) {
    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const testData = data.nextTestBatch(testDataSize);
    const testxs = testData.xs.reshape([testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, 1]);
    const labels = testData.labels.argMax([-1]);
    const preds = model.predict(testxs).argMax([-1]);

    testxs.dispose();
    return [preds, labels];
}


async function showAccuracy(model, data) {
    const [preds, labels] = doPrediction(model, data);
    //const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
    //const container = { name: 'Accuracy', tab: 'Evaluation' };
    //tfvis.show.perClassAccuracy(container, classAccuracy, classNames);

    var p = await preds.data();
    var l = await labels.data();

    document.getElementById("labels").innerHTML = "Predicted Values: " + p.slice(0, 9) + "<br>" + "Actual Values: " + l.slice(0, 9);
    document.getElementById("samples").textContent = "Sample data batch: ";

    labels.dispose();
}

//TODO: need to get the canvas as an array of numbers, convert that to tf.Tensor, resize it to 28x28 and make it predict a value

document.getElementById("submit").onclick = async function () {
    var CanvasData = document.getElementById("imageView").getContext("2d").getImageData(0, 0, 400, 400);
    console.log("Canvas Data Loaded");

    var tfImage = tf.browser.fromPixels(CanvasData, 1);
    console.log("Tensor Created");

    var tfResizedImage = tf.image.resizeNearestNeighbor(tfImage, [28, 28]);
    console.log("Resized Tensor: ");

    console.log(await tfResizedImage.data());

    tfResizedImage = tf.cast(tfResizedImage, 'float32');
    tfResizedImage = tf.abs(tfResizedImage.sub(tf.scalar(255))).div(tf.scalar(255)).flatten();
    console.log("Tensor Modified");

    tfResizedImage = tfResizedImage.reshape([1, 28, 28, 1]);
    console.log("Tensor reshaped");

    var results = global_model.predict(tfResizedImage);

    var p = await results.data();

    p = await p.map(function (x) { return x * 100; })
    console.log(p);
    updater.textContent = "Best Guess: " + await getBest(p);
    results.dispose();
};

var getBest = function (p) {
    var best = 0;
    var best_i = 0;
    for (var i = 0; i < p.length; i++) {
        if (p[i] > best) {
            best = p[i];
            best_i = i;
        }
    }
    return best_i;
};