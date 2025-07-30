import { useState, type FormEvent } from 'react';
import Navbar from '../components/Navbar';
import FileUploader from '~/components/FileUploader';
import { usePuterStore } from '~/lib/puter';
import { useNavigate } from 'react-router';
import { stat } from 'fs';
import { convertPdfToImage } from '~/lib/pdf2img';
import { generateUUID } from '~/lib/utils';
import { prepareInstructions } from '../../constants';

const upload = () => {
  const { auth, fs, ai, kv, isLoading } = usePuterStore();
  const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(false)
    const [statusText, setStatusText] = useState("")
    const [file, setFile] = useState<File | null>(null);

    const handleAnalyse = async ({ companyName, jobTitle, jobDescription, file }: { companyName: string; jobTitle: string; jobDescription: string; file: File }) => {
      setIsProcessing(true);
      setStatusText("Processing your resume...");
      const uploadedFile = await fs.upload([file]);

      if(!uploadedFile) return setStatusText("Failed to upload file");

      setStatusText('Converting to image...');
      const imageFile = convertPdfToImage(file);
      if(!imageFile) return setStatusText("Failed to convert PDF to image");

      setStatusText('Uploading the image...');
      const uploadedImage = await fs.upload([imageFile.file]);
      if(!uploadedImage) return setStatusText("Failed to upload image");

      setStatusText('Preparing data...');

      const uuid = generateUUID();
      const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: '',
      }

      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      setStatusText('Analysing resume...');

      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({
          jobTitle,
          jobDescription,
        })
      )

      if(!feedback) return setStatusText("Failed to analyse resume");

      const feedbackText = typeof feedback.message.content === 'string' ? feedback.message.content : feedback.message.content[0].text;

      data.feedback = JSON.parse(feedbackText);
      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      setStatusText('Analysis complete, redirecting...');
    }

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget.closest('form');
      if (!form) return;
      const formData = new FormData(form);

      const companyName = formData.get('company-name') as string;
      const jobTitle = formData.get('job-title') as string;
      const jobDescription = formData.get('job-description') as string;

      if(!file) return;

      handleAnalyse({ companyName, jobTitle, jobDescription, file });
    }

    const handleFileSelect = (file: File | null) => {
      setFile(file);
    }

  return (<main className="bg-[url('/images/bg-main.svg')] bg-cover">
    <Navbar />

    <section className="main-section">
      <div className='page-heading py-16'>
        <h1>Smart feedback for your dream job</h1>
        {isProcessing ? (
            <>
            <h2>{statusText}</h2>
            <img
                src='/images/resume-scan.gif'
                className='w-full'
            />
            </>
        ) : (
            <h2>Drop your resume for an ATS score and improvement tips</h2>
        )}
        {!isProcessing && (
          <form id='upload-form' onSubmit={handleSubmit} className='flex flex-col gap-4 mt-8'>
            <div className='form-div'>
                <label htmlFor='company-name'>Company Name</label>
                <input type='text' id='company-name' name='company-name' placeholder='Company name' required /> 
            </div>
            <div className='form-div'>
                <label htmlFor='job-title'>Job Title</label>
                <input type='text' id='job-title' name='job-title' placeholder='Job title' required /> 
            </div>
            <div className='form-div'>
                <label htmlFor='job-description'>Job Description</label>
                <textarea rows={5} id='job-description' name='job-description' placeholder='Job description' required /> 
            </div>
            <div className='form-div'>
                <label htmlFor='uploader'>Resume Uploader</label>
                <FileUploader onFileSelect={handleFileSelect}/>
            </div>

            <button className='primary-button' type='submit'>
                Analyse resume
            </button>
          </form>  
        )}
      </div>
    </section>
  </main>
  )
};

export default upload;