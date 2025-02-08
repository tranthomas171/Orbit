from pytube import YouTube

def get_youtube_title(url):
    """
    Given a YouTube URL, use pytube to extract and return the video title.
    """
    try:
        yt = YouTube(url)
        return yt.title
    except Exception as e:
        raise Exception(f"Error extracting title with pytube: {e}")
