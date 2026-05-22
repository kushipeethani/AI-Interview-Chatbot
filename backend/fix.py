import pathlib

path = pathlib.Path('main.py')
content = path.read_text()

if 'load_dotenv()' in content:
    content = content.replace(
        'load_dotenv()',
        'load_dotenv(dotenv_path=pathlib.Path(__file__).parent / ".env", override=True)'
    )
    path.write_text(content)
    print('Fixed!')
else:
    print('Not found - current load_dotenv line:')
    for i, line in enumerate(content.split('\n')):
        if 'load_dotenv' in line:
            print(f'Line {i+1}: {line}')
